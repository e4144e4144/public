// ===== エラー表示用 =====
function showMessage(msg){
 alert(msg);
 console.log(msg);
}

// ===== 標識マスタ =====
const SIGNS = {
 "JP:224":"一時停止",
 "JP:250":"進入禁止",
 "JP:274":"速度制限",
 "JP:325":"駐車禁止",
 "JP:326":"駐停車禁止",
 "JP:301":"右折禁止",
 "JP:302":"左折禁止",
 "JP:303":"Uターン禁止",
 "JP:304":"通行止め",
 "JP:305":"車両進入禁止",
 "JP:306":"歩行者専用",
 "JP:308":"一方通行"
};

// ===== チェックボックス生成 =====
const signList=document.getElementById("signList");
Object.entries(SIGNS).forEach(([code,name])=>{
 const label=document.createElement("label");
 label.innerHTML=`<input type="checkbox" value="${code}" checked>${name}<br>`;
 signList.appendChild(label);
});

// ===== 地図初期化 =====
const map=L.map('map').setView([35.68,139.76],5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);

let markersLayer=L.layerGroup().addTo(map);
let currentMarker,watchId,lastFetchPos;

// ===== 選択取得 =====
function getSelectedCodes(){
 return [...document.querySelectorAll("#signList input:checked")]
        .map(e=>e.value);
}

// ===== Overpass取得 =====
async function fetchSigns(lat,lon,radius,codes){
 try{
   const regex=codes.join("|");

   const query=`
   [out:json][timeout:25];
   node["traffic_sign"~"${regex}"]
   (around:${radius},${lat},${lon});
   out body;`;

   const url="https://overpass-api.de/api/interpreter?data="+encodeURIComponent(query);

   console.log("Overpass query:",url);

   const res=await fetch(url);

   if(!res.ok){
     showMessage("Overpass APIエラー："+res.status);
     return {elements:[]};
   }

   const data=await res.json();
   console.log("取得件数",data.elements.length);

   if(data.elements.length===0){
     showMessage("この周辺に標識データがありません（OSM未登録エリア）");
   }

   return data;

 }catch(e){
   showMessage("通信エラー："+e);
   return {elements:[]};
 }
}

// ===== 表示 =====
async function updateSigns(lat,lon){
 const radius=document.getElementById("radius").value;
 const codes=getSelectedCodes();
 if(codes.length===0){
   showMessage("標識を選択してください");
   return;
 }

 markersLayer.clearLayers();

 const data=await fetchSigns(lat,lon,radius,codes);

 data.elements.forEach(e=>{
   L.marker([e.lat,e.lon])
     .bindPopup("標識: "+e.tags.traffic_sign)
     .addTo(markersLayer);
 });
}

// ===== 現在地検索 =====
async function manualSearch(){
 if(!navigator.geolocation){
   showMessage("GPS未対応ブラウザ");
   return;
 }

 navigator.geolocation.getCurrentPosition(async pos=>{
   const {latitude,longitude}=pos.coords;

   map.setView([latitude,longitude],15);

   if(currentMarker) map.removeLayer(currentMarker);
   currentMarker=L.marker([latitude,longitude]).addTo(map)
     .bindPopup("現在地").openPopup();

   updateSigns(latitude,longitude);

 },err=>{
   showMessage("位置情報許可してください");
 });
}

// ===== 自動更新 =====
function toggleAuto(){
 const btn=document.getElementById("autoBtn");

 if(watchId){
   navigator.geolocation.clearWatch(watchId);
   watchId=null;
   btn.innerText="自動更新OFF";
   return;
 }

 watchId=navigator.geolocation.watchPosition(pos=>{
   const {latitude,longitude}=pos.coords;

   if(!lastFetchPos||distance(lastFetchPos,[latitude,longitude])>100){
     lastFetchPos=[latitude,longitude];
     updateSigns(latitude,longitude);
   }
 },{enableHighAccuracy:true});

 btn.innerText="自動更新ON";
}

// 距離
function distance(a,b){
 const R=6371000;
 const dLat=(b[0]-a[0])*Math.PI/180;
 const dLon=(b[1]-a[1])*Math.PI/180;
 const x=Math.sin(dLat/2)**2+
  Math.cos(a[0]*Math.PI/180)*Math.cos(b[0]*Math.PI/180)*
  Math.sin(dLon/2)**2;
 return 2*R*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}
