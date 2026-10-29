// In-memory NAVER stand-in for offline browser tests only.
module.exports=`
window.__mapCreates=0;window.__mapDestroys=0;window.__maps=[];window.__mapPans=0;window.__mapFits=0;window.__markerCreates=0;window.__markers=[];
window.naver={maps:{
 Point:class {constructor(x,y){this.x=x;this.y=y;}},
 LatLng:class {constructor(lat,lng){this.lat=lat;this.lng=lng;}},
 Map:class {constructor(element,options){this.element=element;this.options=options;window.__mapCreates++;window.__maps.push(this);} destroy(){window.__mapDestroys++;this.element.replaceChildren();} autoResize(){} fitBounds(){window.__mapFits++;} getCenter(){return this.options.center;} getSize(){return {width:390,height:320};} getProjection(){return {fromCoordToOffset:p=>({x:p.lng*100000,y:p.lat*100000}),fromOffsetToCoord:p=>({lng:p.x/100000,lat:p.y/100000})};} panTo(point){window.__mapPans++;this.options.center=point;}},
 Marker:class {constructor(options){window.__markerCreates++;window.__markers.push(this);this.options=options;options.map.element.append(options.icon.content);} setMap(map){if(!map)this.options.icon.content.remove();} setIcon(icon){this.options.icon.content.replaceWith(icon.content);this.options.icon=icon;}},
 Event:{addListener(target,name,callback){if(name==='tilesloaded'){const listener={callback,active:true};target.tileListener=listener;if(!window.__holdTiles)queueMicrotask(()=>{if(listener.active)callback();});return listener;}target.options.icon.content.onclick=callback;return target;} ,removeListener(target){if('active' in target){target.active=false;return;}target.options.icon.content.onclick=null;}}
}};`;
