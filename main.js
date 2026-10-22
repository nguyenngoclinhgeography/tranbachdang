/*
  BẠCH ĐẰNG 938 — SA BÀN 3D TƯƠNG TÁC
  100% JavaScript/WebGL thuần. Không CDN, không framework, không cần máy chủ.
  Có thể mở index.html trực tiếp bằng Microsoft Edge / Google Chrome.
  Tái dựng cách điệu dựa trên ảnh sa bàn thủ công (không phải bản đồ GIS chính xác).
*/
(() => {
'use strict';
const $ = id => document.getElementById(id);
let canvas = $('scene3d');
const app = $('app');
const feedback = $('feedback');
const TWO_PI = 2*Math.PI;
const clamp = (x,a,b)=>Math.max(a,Math.min(b,x));
const mix = (a,b,t)=>a+(b-a)*t;
const smooth = t => {t=clamp(t,0,1);return t*t*(3-2*t);};
const fract = x => x-Math.floor(x);
let randSeed=938;
function rnd(){randSeed=(1664525*randSeed+1013904223)>>>0;return randSeed/4294967296;}
const v3=(x=0,y=0,z=0)=>[x,y,z];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const norm=a=>{const n=Math.hypot(...a)||1;return mul(a,1/n);};
function hex(v){return [(v>>16&255)/255,(v>>8&255)/255,(v&255)/255];}
function shade(v,t=1){return hex(v).map(x=>clamp(x*t,0,1));}
const MAT4=()=>new Float32Array(16);
function identity(){const m=MAT4();m[0]=m[5]=m[10]=m[15]=1;return m;}
function multiply(a,b){const o=MAT4();for(let j=0;j<4;j++)for(let i=0;i<4;i++)o[j*4+i]=a[0*4+i]*b[j*4+0]+a[1*4+i]*b[j*4+1]+a[2*4+i]*b[j*4+2]+a[3*4+i]*b[j*4+3];return o;}
function perspective(fovy,aspect,n,f){const o=MAT4(),g=1/Math.tan(fovy/2);o[0]=g/aspect;o[5]=g;o[10]=(f+n)/(n-f);o[11]=-1;o[14]=2*f*n/(n-f);return o;}
function lookAt(eye,at){const z=norm(sub(eye,at)),x=norm(cross([0,1,0],z)),y=cross(z,x),m=identity();
  m[0]=x[0];m[1]=y[0];m[2]=z[0];m[4]=x[1];m[5]=y[1];m[6]=z[1];m[8]=x[2];m[9]=y[2];m[10]=z[2];
  m[12]=-dot(x,eye);m[13]=-dot(y,eye);m[14]=-dot(z,eye);return m;
}
function modelMatrix(position=[0,0,0],yaw=0,roll=0,pitch=0,scale=1){
 const c=Math.cos(yaw),s=Math.sin(yaw),cr=Math.cos(roll),sr=Math.sin(roll),cp=Math.cos(pitch),sp=Math.sin(pitch);let o=identity();
 // Rx pitch -> Rz roll -> Ry yaw. Column-major matrix.
 const r00=cr,r01=-sr*cp,r02=sr*sp;
 const r10=sr,r11=cr*cp,r12=-cr*sp;
 const r20=0,r21=sp,r22=cp;
 o[0]=(c*r00+s*r20)*scale;o[1]=r10*scale;o[2]=(-s*r00+c*r20)*scale;
 o[4]=(c*r01+s*r21)*scale;o[5]=r11*scale;o[6]=(-s*r01+c*r21)*scale;
 o[8]=(c*r02+s*r22)*scale;o[9]=r12*scale;o[10]=(-s*r02+c*r22)*scale;
 o[12]=position[0];o[13]=position[1];o[14]=position[2];return o;
}
function project(point,viewProj,width,height){const m=viewProj,[x,y,z]=point;
 const w=m[3]*x+m[7]*y+m[11]*z+m[15];if(w<=.01)return null;
 const a=(m[0]*x+m[4]*y+m[8]*z+m[12])/w,b=(m[1]*x+m[5]*y+m[9]*z+m[13])/w;
 return {x:(a*.5+.5)*width,y:(-.5*b+.5)*height,visible:Math.abs(a)<1.45&&Math.abs(b)<1.45};
}
function Builder(){this.data=[];}
Builder.prototype.tri=function(a,b,c,color){const n=norm(cross(sub(b,a),sub(c,a))),col=Array.isArray(color)?color:hex(color);
 for(const p of [a,b,c])this.data.push(p[0],p[1],p[2],n[0],n[1],n[2],col[0],col[1],col[2]);};
Builder.prototype.quad=function(a,b,c,d,color){this.tri(a,b,c,color);this.tri(a,c,d,color);};
Builder.prototype.box=function(cx,cy,cz,w,h,d,color){const x=cx,y=cy,z=cz,ww=w/2,hh=h/2,dd=d/2;
 const p=[[-ww,-hh,-dd],[ww,-hh,-dd],[ww,hh,-dd],[-ww,hh,-dd],[-ww,-hh,dd],[ww,-hh,dd],[ww,hh,dd],[-ww,hh,dd]].map(q=>add(q,[x,y,z]));
 for(const [ids,t] of [[[0,1,2,3],.81],[[5,4,7,6],.91],[[4,0,3,7],.75],[[1,5,6,2],.94],[[3,2,6,7],1.14],[[4,5,1,0],.77]])this.quad(...ids.map(i=>p[i]),shade(color,t));};
Builder.prototype.cone=function(at,r,h,color,seg=9,axis=[0,1,0]){const v=norm(axis),u=norm(cross(Math.abs(v[1])>.8?[1,0,0]:[0,1,0],v)),w=cross(v,u),top=add(at,mul(v,h));
 for(let i=0;i<seg;i++){const a=i*TWO_PI/seg,b=(i+1)*TWO_PI/seg,p=add(at,add(mul(u,r*Math.cos(a)),mul(w,r*Math.sin(a)))),q=add(at,add(mul(u,r*Math.cos(b)),mul(w,r*Math.sin(b))));this.tri(p,q,top,shade(color,.87+rnd()*.25));}};
Builder.prototype.cylinder=function(a,b,r1,r2,color,segments=8){const axis=norm(sub(b,a)),u=norm(cross(Math.abs(axis[1])>.8?[1,0,0]:[0,1,0],axis)),w=cross(axis,u);
 for(let i=0;i<segments;i++){const t=i*TWO_PI/segments,tt=(i+1)*TWO_PI/segments;
 const p=add(a,add(mul(u,Math.cos(t)*r1),mul(w,Math.sin(t)*r1))),q=add(a,add(mul(u,Math.cos(tt)*r1),mul(w,Math.sin(tt)*r1)));
 const r=add(b,add(mul(u,Math.cos(tt)*r2),mul(w,Math.sin(tt)*r2))),s=add(b,add(mul(u,Math.cos(t)*r2),mul(w,Math.sin(t)*r2)));
 this.quad(p,q,r,s,shade(color,.88+.17*Math.cos(t)));}};
Builder.prototype.sphere=function(center,rx,ry,rz,color,lat=5,lon=8){for(let j=0;j<lat;j++){const a=-Math.PI/2+j*Math.PI/lat,b=-Math.PI/2+(j+1)*Math.PI/lat;
 for(let i=0;i<lon;i++){const c=i*TWO_PI/lon,d=(i+1)*TWO_PI/lon;
 const p=(alt,az)=>[center[0]+rx*Math.cos(alt)*Math.cos(az),center[1]+ry*Math.sin(alt),center[2]+rz*Math.cos(alt)*Math.sin(az)];const co=shade(color,.9+rnd()*.19);
 this.quad(p(a,c),p(a,d),p(b,d),p(b,c),co);}}};
function pointInPolygon(x,z,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
 const a=poly[i],b=poly[j];if((a[1]>z)!=(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1]+1e-8)+a[0])yes=!yes;}return yes;}
function bounds(poly){return {minx:Math.min(...poly.map(p=>p[0])),maxx:Math.max(...poly.map(p=>p[0])),minz:Math.min(...poly.map(p=>p[1])),maxz:Math.max(...poly.map(p=>p[1]))};}
let gl, shader, attrib, uni, vp=identity(), width=0,height=0;
let fallback2D = false, ctx2D = null, fallbackFaces = [];
let lastFallbackFrame = -Infinity;
const opaque=[],transparent=[],boats=[],waterRings=[];
function createShader(src,kind){const s=gl.createShader(kind);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('Lỗi đồ họa: '+gl.getShaderInfoLog(s));return s;}
function initGL(){gl=canvas.getContext('webgl',{alpha:false,antialias:true,depth:true,premultipliedAlpha:false,powerPreference:'high-performance'})||canvas.getContext('experimental-webgl');
 if(!gl)throw Error('Trình duyệt không cung cấp WebGL. Hãy bật tăng tốc đồ họa trong Edge/Chrome.');
 const vs=`precision mediump float;
precision mediump int;
attribute vec3 aPos;attribute vec3 aNormal;attribute vec3 aColor;
 uniform mat4 uViewProj;uniform mat4 uModel;uniform float uTime;uniform float uWater;
 varying vec3 vColor;varying vec3 vNormal;varying vec3 vWorld;varying float vWater;
 void main(){vec3 p=aPos;
 if(uWater>0.5){p.y+=.024*sin(p.x*2.4+uTime*1.8)+.018*cos(p.z*2.9-uTime*1.55)+.015*sin((p.z+p.x)*1.7+uTime*1.2);}
 vec4 world=uModel*vec4(p,1.);vWorld=world.xyz;vColor=aColor;vNormal=normalize(mat3(uModel)*aNormal);vWater=uWater;gl_Position=uViewProj*world;}`;
 const fs=`precision mediump float;
precision mediump int;
varying vec3 vColor;varying vec3 vNormal;varying vec3 vWorld;varying float vWater;
 uniform float uAlpha;uniform float uTime;
 void main(){vec3 light=normalize(vec3(-.55,1.,.45));float br=.67+.37*max(dot(normalize(vNormal),light),0.);
 vec3 c=vColor*br;
 if(vWater>.5){float wave=sin(vWorld.x*3.6+uTime*1.8)*cos(vWorld.z*4.3-uTime*.8);float glint=pow(max(0.,sin(vWorld.x*5.6+vWorld.z*1.5+uTime*1.4)),18.);
 c=vec3(.09,.43,.66)+.075*wave+glint*vec3(.22,.27,.28);c=mix(c,vColor,.3);}
 gl_FragColor=vec4(c,uAlpha);}`;
 shader=gl.createProgram();gl.attachShader(shader,createShader(vs,gl.VERTEX_SHADER));gl.attachShader(shader,createShader(fs,gl.FRAGMENT_SHADER));gl.linkProgram(shader);
 if(!gl.getProgramParameter(shader,gl.LINK_STATUS))throw Error('WebGL shader liên kết thất bại: '+gl.getProgramInfoLog(shader));
 attrib={pos:gl.getAttribLocation(shader,'aPos'),normal:gl.getAttribLocation(shader,'aNormal'),color:gl.getAttribLocation(shader,'aColor')};
 uni={vp:gl.getUniformLocation(shader,'uViewProj'),model:gl.getUniformLocation(shader,'uModel'),time:gl.getUniformLocation(shader,'uTime'),water:gl.getUniformLocation(shader,'uWater'),alpha:gl.getUniformLocation(shader,'uAlpha')};
 gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.clearColor(.067,.18,.248,1);
}
function mesh(builder){if(builder.data.length===0)return null;
 if(fallback2D)return {raw:new Float32Array(builder.data),count:builder.data.length/9};
 const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(builder.data),gl.STATIC_DRAW);return {buffer,count:builder.data.length/9};}
function addOpaque(builder){let obj=mesh(builder);if(obj)opaque.push(obj);return obj;}
function addTrans(builder){let obj=mesh(builder);if(obj)transparent.push(obj);return obj;}
function draw(meshObj,model=identity(),opacity=1,isWater=0){if(!meshObj)return;gl.bindBuffer(gl.ARRAY_BUFFER,meshObj.buffer);
 const stride=9*4;for(const [attr,offset] of [[attrib.pos,0],[attrib.normal,12],[attrib.color,24]]){gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,3,gl.FLOAT,false,stride,offset);}
 gl.uniformMatrix4fv(uni.model,false,model);gl.uniform1f(uni.alpha,opacity);gl.uniform1f(uni.water,isWater);gl.drawArrays(gl.TRIANGLES,0,meshObj.count);
}
const world={w:24,d:16,land:[],postPositions:[]};
function buildBoard(){const b=new Builder();b.box(0,-.31,0,24,.62,16,0x1489bc);b.box(0,-.012,0,23.75,.045,15.75,0x1e8bbe);
 // Đường viền màu xanh dương nhạt như mép tấm xốp thật
 b.box(0,-.49,7.98,24,.07,.065,0x39a5cc);b.box(-11.99,-.49,0,.05,.07,16,0x2698c2);
 addOpaque(b);
}
function buildIslands(){const wall=new Builder(),grass=new Builder(),detail=new Builder();
 const islands=[
  {name:'Tả ngạn phía bắc',p:[[-11.9,-7.8],[-7.7,-7.8],[-6.6,-6.7],[-6.5,-4.3],[-7.9,-2.9],[-10,-3.1],[-11.9,-3.9]],h:1.28,t:0,tufts:82},
  {name:'Tả ngạn giữa',p:[[-11.9,-3.3],[-10.3,-3.1],[-8.8,-3.4],[-7.3,-2.7],[-6.7,-1.2],[-7.8,.2],[-9.3,.1],[-10.4,1.6],[-11.9,1.0]],h:1.06,t:0,tufts:72},
  {name:'Đất ven Giao Châu',p:[[-12,4.6],[-10.7,4.3],[-9.2,5.1],[-7.9,5.9],[-7.8,7.9],[-12,7.9]],h:.98,t:0,tufts:55},
  {name:'Lục Châu',p:[[-1.8,-7.85],[4,-7.84],[7.1,-7.3],[9.8,-6.8],[10,-4.65],[7.9,-3.8],[6.3,-3.45],[4.4,-4.2],[2.6,-3.2],[.5,-3.7],[-.8,-5.5]],h:1.17,t:1,tufts:100},
  {name:'Bờ nhô ra vùng phục kích',p:[[-.8,-3.4],[1.7,-3.4],[3.2,-2.3],[4.2,-.95],[3.6,.3],[1.5,.35],[.6,-1.05],[-.85,-1.6]],h:1.03,t:1,tufts:45},
  {name:'Vạt đất lục châu',p:[[10.4,-6.85],[12,-6.6],[12,-3.7],[10.4,-2.4],[9.2,-3.2],[9.9,-4.8]],h:.7,t:1,tufts:16},
  {name:'Đảo Cát Bà',p:[[8.6,2.4],[11.1,2.4],[12,3.45],[12,7.95],[6.7,7.95],[6.3,5.2],[7.4,3.4]],h:1.32,t:2,tufts:95},
  {name:'Đảo tiền tiêu',p:[[1.7,3.2],[3.6,2.9],[4.6,4.15],[3.9,5.3],[1.95,5.3],[1.4,4.45]],h:.89,t:2,tufts:20},
  {name:'Đảo trước cửa sông',p:[[-5.6,6.45],[-4.05,6.18],[-1.8,6.8],[-2.35,7.94],[-5.4,7.92]],h:.77,t:0,tufts:22},
  {name:'Cù lao nhỏ',p:[[-5.9,1.3],[-4.3,1.1],[-3.2,1.85],[-3.9,3.12],[-5.5,3.05]],h:.79,t:0,tufts:17},
  {name:'Đất cạnh bãi cọc',p:[[-3.2,-3.2],[-1.8,-3.0],[-1.0,-2.2],[-1.7,-1.25],[-3,-1.5],[-4,-2.3]],h:.75,t:1,tufts:10},
  {name:'Bờ bên trái cọc',p:[[-7.2,-.55],[-6.1,-1.3],[-4.9,-1.45],[-4.5,-.35],[-5.2,.85],[-7.1,.7]],h:.85,t:0,tufts:25},
  {name:'Đảo đá hạ lưu',p:[[10.5,-7.8],[12,-7.8],[12,-7.1],[11,-6.8]],h:.83,t:1,tufts:9}
 ];
 world.land=islands;
 for(const [ii,is] of islands.entries()){
  const p=is.p,c=[p.reduce((a,b)=>a+b[0],0)/p.length,p.reduce((a,b)=>a+b[1],0)/p.length];let h=is.h;
  // Tường đất xanh đậm bằng những mặt cắt thô giống xốp, thay vì địa hình phẳng.
  for(let j=0;j<p.length;j++){const a=p[j],d=p[(j+1)%p.length],jitter=rnd()*.09;
   wall.quad([a[0],-.01,a[1]],[d[0],-.01,d[1]],[d[0],h+jitter,d[1]],[a[0],h+jitter,a[1]],shade(0x23783e,.75+rnd()*.3));
   wall.quad([a[0],h-.19,a[1]],[d[0],h-.19,d[1]],[d[0],h+jitter,d[1]],[a[0],h+jitter,a[1]],shade(0x164f2d,.8+rnd()*.22));
   const a2=[mix(a[0],c[0],.13),h+.12,a[1]*.87+c[1]*.13],b2=[mix(d[0],c[0],.13),h+.12,d[1]*.87+c[1]*.13];
   grass.quad([a[0],h+jitter,a[1]],[d[0],h+jitter,d[1]],b2,a2,shade(0x2d9e40,.84+rnd()*.28));
   grass.tri(a2,b2,[c[0]+(rnd()-.5)*.28,h+.2+rnd()*.1,c[1]+(rnd()-.5)*.28],shade(0x49c646,.85+rnd()*.25));
  }
  const box=bounds(p);
  for(let n=0,tries=0;n<is.tufts&&tries<is.tufts*11;tries++){
   let x=mix(box.minx,box.maxx,rnd()),z=mix(box.minz,box.maxz,rnd());if(!pointInPolygon(x,z,p))continue;
   const size=.1+rnd()*.23;
   if(!fallback2D||n%7===0)detail.sphere([x,h+.19+size*.17,z],size*.95,size*.35,size*.7,[0x246f2e,0x359637,0x4fa840,0x217b35,0x58b64b][Math.floor(rnd()*5)],3,5);n++;
  }
  // Một vài bụi rêu cao đúng kiểu sa bàn thủ công.
  const special=(ii===0?14:(ii===3?11:(ii===6?10:2)));
  for(let n=0,tries=0;n<special&&tries<special*15;tries++){
   const x=mix(box.minx,box.maxx,rnd()),z=mix(box.minz,box.maxz,rnd());if(!pointInPolygon(x,z,p))continue;
   const r=.25+rnd()*.48;
   if(!fallback2D||n%2===0)detail.sphere([x,h+.24+r*.45,z],r,r*.55,r*.84,[0x1b7633,0x208739,0x38972e,0x55a631][Math.floor(rnd()*4)],5,7);n++;
  }
 }
 addOpaque(wall);addOpaque(grass);addOpaque(detail);
}
function buildStakes(){const b=new Builder(),spots=[];
 // Bãi cọc cắm thành hàng xiên, ở trung tâm trận địa giống ảnh chụp cận cảnh.
 for(let j=0;j<3;j++)for(let i=0;i<6;i++){
   let x=-3.05+i*.73+j*.18+(rnd()-.5)*.14,z=.35+j*.55-i*.085+(rnd()-.5)*.15;
   spots.push([x,z]);const lean=[.10+(rnd()-.5)*.13,0,.07+(rnd()-.5)*.16];
   const a=[x,.06,z],tipBase=[x+lean[0],.74+(rnd()-.5)*.16,z+lean[2]],tip=[tipBase[0]+lean[0]*.17,1.01+(rnd()-.5)*.13,tipBase[2]+lean[2]*.17];
   b.cylinder(a,tipBase,.10,.08,[0x4d3020,0x533b2c,0x664629][i%3],7);
   b.cone(tipBase,.11,Math.max(.16,tip[1]-tipBase[1]),0xabb9bd,7,norm(sub(tip,tipBase)));
 }
 world.postPositions=spots;addOpaque(b);
 const rim=new Builder(); // Một vài cọc cắm ở sát hai mép (như mô hình thật).
 for(const [x,z] of [[-4.3,.72],[-4.8,1.45],[1.2,.3]]){
  rim.cylinder([x,.06,z],[x-.16,.80,z-.13],.105,.085,0x483020,8);
  rim.cone([x-.16,.8,z-.13],.11,.28,0xb8c5c7,8,[-.12,1,-.07]);
 }
 addOpaque(rim);
}
function makeArrowMesh(points,col=0x329fe9,dashed=false){const b=new Builder();
 let vertices=[];for(let k=0;k<points.length-1;k++){
  const a=points[k],c=points[k+1],len=Math.hypot(c[0]-a[0],c[1]-a[1]);
  for(let j=0;j<Math.ceil(len/.16);j++){let s=j/Math.ceil(len/.16);vertices.push([mix(a[0],c[0],s),0,mix(a[1],c[1],s)]);}
 }vertices.push([points.at(-1)[0],0,points.at(-1)[1]]);
 for(let i=0;i<vertices.length-1;i++){
  if(dashed&&Math.floor(i/5)%2)continue;
  const a=vertices[i],c=vertices[i+1],dx=c[0]-a[0],dz=c[2]-a[2],normDist=Math.hypot(dx,dz)||1;
  const perp=[-dz/normDist,0,dx/normDist];const wid=dashed?.094:.13;
  const aa=add(a,mul(perp,wid)),bb=add(a,mul(perp,-wid)),cc=add(c,mul(perp,-wid)),dd=add(c,mul(perp,wid));
  // Viền trắng ngoài giống mũi tên cắt giấy trên sa bàn
  b.quad(add(a,mul(perp,wid+.07)),add(a,mul(perp,-wid-.07)),add(c,mul(perp,-wid-.07)),add(c,mul(perp,wid+.07)),0xd4f1ff);
  b.quad(aa,bb,cc,dd,col);
 }
 const last=vertices.at(-1),prev=vertices.at(-2),direction=norm(sub(last,prev)),p=[-direction[2],0,direction[0]];
 const base=sub(last,mul(direction,.47));b.tri(add(base,mul(p,.4)),last,add(base,mul(p,-.4)),0xf8ffff);
 const inner=sub(last,mul(direction,.1)),b2=sub(last,mul(direction,.43));b.tri(add(b2,mul(p,.27)),inner,add(b2,mul(p,-.27)),col);
 return b;
}
let arrowMesh=null;
function buildArrows(){const a=new Builder();
 const paths=[
  {p:[[8.8,1.9],[7.3,2.2],[6.2,2.5],[5.7,3.4]],c:0x237fd3},
  {p:[[5.6,3.5],[4.0,4.4],[2.0,4.5],[.4,4.1]],c:0x238be0},
  {p:[[.2,4.1],[-.7,3.8],[-1.5,3.2]],c:0x328fdf},
  {p:[[-7.2,-2.0],[-6.6,-1.4],[-5.7,-.9]],c:0xd34646},
  {p:[[-1.2,-2.3],[-1.8,-1.5],[-2.4,-.85]],c:0xd34646}
 ];
 for(const path of paths)a.data.push(...makeArrowMesh(path.p,path.c,!!path.d).data);
 arrowMesh=mesh(a);
 buildTacticalArrows();
}
/* Mũi tên đỏ động thay đổi hướng theo ba giai đoạn thực tế của chiến thuật. */
const tacticalPaths={
 sortie:[[-5.65,2.72],[-3.7,2.73],[-1.25,3.07],[1.45,3.20],[3.90,2.83]],
 lure:[[4.15,3.72],[2.20,3.88],[-.65,4.03],[-2.90,3.78],[-4.48,3.47]],
 retreat:[[-4.43,3.48],[-4.98,3.89],[-5.62,4.19],[-6.32,4.24],[-7.22,3.66]]
};
const tacticalFrames={sortie:[],lure:[],retreat:[]};
function partialPolyline(points,fraction){
 const lens=[];let total=0;
 for(let i=1;i<points.length;i++){const len=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);lens.push(len);total+=len;}
 const target=clamp(fraction,.06,1)*total;
 const out=[points[0]];let progress=0;
 for(let i=1;i<points.length;i++){
  if(progress+lens[i-1]>=target){const s=(target-progress)/lens[i-1];out.push([mix(points[i-1][0],points[i][0],s),mix(points[i-1][1],points[i][1],s)]);break;}
  out.push(points[i]);progress+=lens[i-1];
 }
 return out.length>=2?out:[points[0],points[1]];
}
function buildTacticalArrows(){
 for(const [key,points] of Object.entries(tacticalPaths)){
  for(let i=0;i<=30;i++){
   const partial=partialPolyline(points,.08+.92*i/30);
   tacticalFrames[key].push(mesh(makeArrowMesh(partial,0xe13e48,false)));
  }
 }
}
function tacticalAtTime(){
 const t=sceneState.time;
 let type,progress,label;
 if(t>=8&&t<15){type='sortie';progress=smooth((t-8)/6.4);label='QUÂN TA TIẾN RA KHIÊU CHIẾN';}
 else if(t>=15&&t<27){type='lure';progress=smooth((t-15)/10);label='QUÂN TA GIẢ RÚT – NHỬ ĐỊCH';}
 else if(t>=27){type='retreat';progress=smooth((t-27)/13.5);label='QUÂN TA RÚT QUA BÃI CỌC';}
 else return null;
 const idx=Math.min(30,Math.max(0,Math.round(progress*30)));
 return {type,progress,mesh:tacticalFrames[type][idx],label,
   endpoint:partialPolyline(tacticalPaths[type],.08+.92*idx/30).at(-1)};
}
function buildArmies(){const b=new Builder();
 // Quân ta mai phục với khiên, giáo và cung tên; phong cách tượng nhỏ thủ công.
 const people=[[-6.9,-2.2,0.3],[-7.25,-.4,.6],[-4.3,-2.5,.2],[-2,-2.8,-.3],[1.3,-1.5,-.5],[2.7,-1.3,.3],[-6.6,1.25,.3],[-4.9,2.9,-.3]];
 people.forEach(([x,z,rot],idx)=>soldier(b,[x,1.03,z],.66+((idx%3)-1)*.08,rot,idx%2===0));
 // Biểu tượng những cánh quân phục kích cắt từ giấy đỏ ở hai bờ.
 for(const [x,z] of [[-6.7,1.0],[-7.7,1.55],[-6.25,2.75],[1.6,-1.45],[2.65,-.5],[3.8,-.05]]){
  const y=1.08; b.quad([x-.32,y,z-.22],[x+.4,y,z-.12],[x+.45,y,z+.21],[x-.25,y,z+.12],0xa42d2c);
  b.tri([x+.43,y,z-.33],[x+.91,y,z+.05],[x+.43,y,z+.28],0xbf3a35);
 }
 addOpaque(b);
}
function soldier(b,position,scale,angle,archer){const [x,y,z]=position;const b0=new Builder();
 b0.cylinder([0,0,0],[0,.65,0],.105,.10,0x7b3828,7);
 b0.sphere([0,.76,0],.13,.16,.13,0xc99d71,4,7); // đầu
 b0.cone([0,.80,0],.17,.20,0x94352b,6);
 b0.cylinder([-.07,0,0],[-.13,-.30,.05],.06,.045,0x4e3122,6);b0.cylinder([.07,0,0],[.16,-.28,.03],.06,.045,0x4e3122,6);
 b0.cylinder([-.09,.58,0],[-.30,.36,.08],.055,.044,0xb78657,6);
 b0.cylinder([.09,.58,0],[.34,.45,-.04],.055,.044,0xb78657,6);
 if(archer){ // hình cung với dây cung nhỏ
  b0.cylinder([-.35,.12,.05],[-.31,.87,.05],.027,.027,0xb28045,5);
  b0.cylinder([-.31,.87,.05],[-.20,.5,.10],.017,.017,0xb9ad82,4);
  b0.cylinder([-.20,.5,.10],[-.35,.12,.05],.012,.012,0xb9ad82,4);
 }else{b0.cylinder([.27,.3,.0],[.49,1.12,.07],.035,.025,0x7c573d,5);b0.cone([.49,1.12,.07],.075,.18,0xb9c3c8,6,[.25,.9,.08]);}
 const c=Math.cos(angle),s=Math.sin(angle);for(let i=0;i<b0.data.length;i+=9){let px=b0.data[i],py=b0.data[i+1],pz=b0.data[i+2];b0.data[i]=x+scale*(px*c+pz*s);b0.data[i+1]=y+scale*py;b0.data[i+2]=z+scale*(-px*s+pz*c);}
 b.data.push(...b0.data);
}
function hull(b,L,W,c1,c2){const rings=[[-L*.53,.13],[-L*.45,.63],[-L*.30,.96],[-L*.05,1],[L*.25,.97],[L*.43,.58],[L*.54,.12]];
 // Sống thuyền thon đầu, mép cao - mô phỏng chiến thuyền gỗ chứ không phải khối hộp.
 for(let i=0;i<rings.length-1;i++){
  let [z,f]=rings[i],[zz,ff]=rings[i+1];const at=z<0?.04:.015,bt=zz>0?.16:.015;
  const left=[-W*f*.53,-.32+at,z],right=[W*f*.53,-.32+at,z],left2=[-W*ff*.53,-.32+bt,zz],right2=[W*ff*.53,-.32+bt,zz];
  const upperLeft=[-W*f*.55,.30+at,z],upperRight=[W*f*.55,.30+at,z],upperLeft2=[-W*ff*.55,.30+bt,zz],upperRight2=[W*ff*.55,.30+bt,zz];
  b.quad(left,left2,upperLeft2,upperLeft,shade(c1,.88));b.quad(right,upperRight,upperRight2,right2,shade(c1,.98));
  b.quad(left,right,right2,left2,shade(c1,.65));
  b.quad(upperLeft,upperLeft2,upperRight2,upperRight,shade(c2,.85));
  // băng ván nổi theo thành tàu
  for(const y of [-.12,.13]){
   b.cylinder([left[0],y,z],[left2[0],y,zz],.024,.024,c2,5);
   b.cylinder([right[0],y,z],[right2[0],y,zz],.024,.024,c2,5);
  }
 }
 b.cylinder([0,.22,-L*.5],[0,.48,-L*.56],.10,.075,c1,7);
 b.cylinder([0,.3,L*.5],[0,.65,L*.57],.075,.048,c1,7);
}
function curvedSail(b,cx,z,top,width,height,color,twist=0){const nx=10,ny=7;
 for(let i=0;i<nx;i++)for(let j=0;j<ny;j++){
  const point=(u,v)=>{
   const x=cx+(u-.5)*width*(.98-.12*v),y=top-v*height;
   const puff=.73*Math.sin(u*Math.PI)*(.32+.68*Math.sin(v*Math.PI))+.10*Math.sin((u+v)*Math.PI*2)+twist*v;
   return [x,y,z+puff];
  };
  const a=point(i/nx,j/ny),bb=point((i+1)/nx,j/ny),c=point((i+1)/nx,(j+1)/ny),d=point(i/nx,(j+1)/ny);
  b.quad(a,bb,c,d,shade(color,(i+j)%3===0?1.16:((i+j)%4===0?.9:1.03)));
 }
 b.cylinder([cx-width*.47,top,z],[cx+width*.47,top,z],.018,.018,0xa96a39,5);
}

/* Đầu thuyền nhọn, thanh lan can, mái chèo, dây buồm — phỏng theo sa bàn gốc */
function makeEnemyShip(id){
 const b=new Builder(),L=id===0?3.25:2.88,W=id===0?1.24:1.10;
 hull(b,L,W,0x1c2023,0x6b4b31);
 // Mặt boong, ván gỗ, mạn đen có đai đồng.
 b.box(0,.335,-.16,W*.76,.052,L*.67,0x6c492e);
 for(let k=0;k<11;k++){
  const zz=-L*.35+k*L*.067;
  b.box(0,.368,zz,W*.74,.012,.023,k%2?0x98734a:0x4c3927);
 }
 for(const side of [-1,1]){
  b.cylinder([side*W*.48,.37,-L*.37],[side*W*.40,.53,-L*.35],.035,.035,0xb48343,6);
  b.cylinder([side*W*.45,.49,-L*.35],[side*W*.46,.49,L*.32],.036,.036,0x85522f,6);
  for(let k=0;k<7;k++){
   let z=-L*.34+k*L*.103;
   b.cylinder([side*W*.45,.31,z],[side*W*.45,.58,z],.028,.026,0x4c3021,6);
   b.box(side*W*.49,.02,z,.055,.16,.075,0x9d7846);
  }
 }
 b.box(0,.56,-L*.39,W*.64,.39,.51,0x27272a);
 b.box(0,.80,-L*.39,W*.78,.055,.59,0x7a5232);
 // Đầu thuyền có chạm khắc dạng đầu rồng cách điệu.
 b.cylinder([0,.44,L*.50],[0,.65,L*.65],.09,.05,0xa07d4b,7);
 b.sphere([0,.67,L*.65],.10,.095,.14,0x9b7337,4,7);
 for(let j=0;j<3;j++)b.cone([0,.63+j*.09,L*.60],.06,.13,0xd3ad62,6,[0,.4,1]);
 // Buồm vải cam có các tầng uốn cong giống thuyền trong sa bàn thật.
 for(const [z,y] of [[-.42,2.38],[.53,2.19]]){
  b.cylinder([0,.24,z],[0,y+.14,z],.052,.037,0x916333,8);
  let span=z<0?1.46:1.23;
  curvedSail(b,0,z,y-.13,span,.54,0xf99127,.10);
  curvedSail(b,0,z,y-.72,span*.94,.50,0xe97920,.14);
  curvedSail(b,0,z,y-1.29,span*.78,.38,0xffb34f,.12);
  for(let tier=0;tier<3;tier++){
   const h=y-.12-tier*.57;
   b.cylinder([-span*.48,h,z],[span*.48,h,z],.025,.025,0xc4904d,5);
  }
  // Dây buồm vòng xuống mũi và đuôi, nhìn rõ trong góc cận cảnh.
  b.cylinder([0,y,z],[W*.46,.47,L*.35],.014,.012,0xdbbd8e,5);
  b.cylinder([0,y,z],[-W*.46,.47,-L*.3],.014,.012,0xdbbd8e,5);
 }
 return {id,kind:'enemy',mesh:mesh(b),pos:[0,0,0],angle:0,roll:0,pitch:0,scale:1,hit:0};
}
function makeFriendlyBoat(id){
 const b=new Builder();hull(b,id===0?2.09:1.84,.60,0x533420,0xac7847);
 // Mạn gỗ sáng, ghế chèo, mũi thuyền cong.
 b.box(0,.29,-.05,.46,.048,1.32,0x80603b);
 for(let j=0;j<5;j++){
  const z=-.64+j*.31;
  b.box(0,.33,z,.52,.052,.09,0xb78952);
  b.cylinder([-.29,.30,z],[-.91,.12,z+.30],.026,.026,0xd5b177,6);
  b.cylinder([.29,.30,z],[.91,.12,z+.30],.026,.026,0xd5b177,6);
  b.box(-.90,.09,z+.30,.15,.028,.33,0x9a6b39);
  b.box(.90,.09,z+.30,.15,.028,.33,0x9a6b39);
 }
 for(const sign of [-1,1]){
  b.cylinder([sign*.26,.43,-.92],[sign*.26,.43,.88],.025,.025,0xd3a56b,5);
 }
 // Lá cờ vải đỏ trên chiếc thuyền nhỏ.
 b.cylinder([0,.30,-.52],[0,1.18,-.52],.027,.025,0x866140,6);
 b.tri([0,1.19,-.52],[.42,1.06,-.52],[0,1.00,-.52],0xc62b25);
 b.tri([0,1.00,-.52],[.42,1.06,-.52],[.16,.94,-.52],0xe64838);
 return {id,kind:'friendly',mesh:mesh(b),pos:[0,0,0],angle:0,roll:0,pitch:0,scale:1,hit:0};
}
/* Nhân vật 3D tách rời để có thể rơi khỏi tàu / ngã trên boong.
   Áo quân ta đỏ sẫm, khăn đỏ và khiên gỗ; quân Nam Hán mặc giáp lam đen, mũ sắt tối, viền đồng.
   Màu sắc và trang bị ở đây là cách điệu phục vụ nhận biết hai phe, không khẳng định phục trang khảo cổ. */
const crew=[];
let meshFriendly,meshEnemy,meshEnemyDown,meshEnemySwimming,fireMesh,smokeMesh,foamyRing,debrisMesh;
function makeCrewFigure(side,pose='stand'){
 const b=new Builder(),ours=side==='friendly';
 const tunic=ours?0xa72d24:0x263946;
 const armor=ours?0x6c2f1e:0x3e4850;
 const trim=ours?0xe4a957:0xbc8a4c;
 const cloth=ours?0xc84d32:0x51666e;
 const helmet=ours?0xa62d20:0x30363e;
 const skin=0xc8976b;
 if(pose==='swim'){
  b.sphere([0,.11,0],.20,.18,.19,skin,5,8);
  b.cone([0,.20,0],.19,.17,helmet,8);
  b.sphere([-.07,.13,-.18],.13,.08,.13,cloth,4,7);
  b.cylinder([-.10,.05,.05],[-.50,.06,.28],.062,.043,cloth,7);
  b.cylinder([.10,.05,.05],[.46,.06,-.20],.062,.043,cloth,7);
  return mesh(b);
 }
 // Đùi, giày, áo vải, giáp, đai, cầu vai.
 for(const sign of [-1,1]){
  b.cylinder([sign*.10,.39,0],[sign*.13,.03,sign*.035],.085,.071,ours?0x563727:0x3c3938,8);
  b.box(sign*.13,.02,.08,.16,.12,.23,0x31271e);
 }
 b.box(0,.70,0,.34,.53,.28,tunic);
 b.box(0,.67,-.16,.36,.35,.042,armor);
 b.box(0,.47,-.01,.42,.12,.32,trim);
 b.box(0,.61,.148,.085,.41,.03,trim);
 b.cone([0,.95,0],.18,.20,ours?0xb32c25:0x42474c,9);
 b.sphere([0,1.06,.005],.155,.175,.14,skin,6,8);
 if(ours){
  b.box(0,1.21,.006,.34,.065,.19,0xe04a36); // khăn quấn trán
  b.cone([.02,1.24,-.03],.14,.27,helmet,7,[.13,1,.07]);
  // Khiên tròn đỏ viền đồng, lao gỗ có mũi sắt.
  b.cylinder([-.37,.70,.21],[-.37,.70,.27],.24,.24,0x824125,12);
  b.sphere([-.37,.70,.29],.13,.13,.047,0xcb853b,6,9);
  b.cylinder([.28,.51,.16],[.42,1.64,.24],.025,.020,0x764627,6);
  b.cone([.42,1.63,.24],.07,.19,0xd7dbd3,7,[.12,.98,.08]);
 }else{
  // Nón sắt tối chóp nhọn, viền vàng đồng và tấm bảo vệ vai.
  b.cone([0,1.19,0],.20,.24,helmet,9);
  b.cylinder([-.24,.86,0],[-.30,.59,.04],.125,.08,0x59606a,7);
  b.cylinder([.24,.86,0],[.30,.59,.04],.125,.08,0x59606a,7);
  b.box(0,1.10,-.14,.32,.07,.095,trim);
  b.cylinder([.28,.60,.14],[.42,1.55,.18],.035,.023,0x7c4d35,6);
  b.cone([.42,1.52,.18],.075,.17,0xc0c8ca,7,[.08,1,.04]);
 }
 for(const sign of [-1,1]){
  b.cylinder([sign*.22,.84,0],[sign*.31,.58,.07],.083,.065,cloth,7);
  b.sphere([sign*.31,.53,.08],.085,.08,.08,skin,4,7);
 }
 return mesh(b);
}
function buildShips(){
 boats.push(makeFriendlyBoat(0),makeFriendlyBoat(1),makeEnemyShip(0),makeEnemyShip(1));
 meshFriendly=makeCrewFigure('friendly');meshEnemy=makeCrewFigure('enemy');
 meshEnemyDown=makeCrewFigure('enemy');meshEnemySwimming=makeCrewFigure('enemy','swim');
 for(const ship of [0,1]){
  crew.push({ship,side:'friendly',at:[-.07,.36,-.17],type:'onboard'});
  crew.push({ship,side:'friendly',at:[.07,.35,.48],type:'onboard'});
 }
 for(const ship of [2,3]){
  crew.push({ship,side:'enemy',at:[-.21,.41,-.72],type:'onboard',fate:ship===2?'overboard-left':'none',event:46.9});
  crew.push({ship,side:'enemy',at:[.20,.41,.14],type:'onboard',fate:'deck',event:ship===2?47.4:50.0});
  crew.push({ship,side:'enemy',at:[-.10,.41,.90],type:'onboard',fate:ship===2?'overboard-right':'overboard-right',event:ship===2?49.0:51.0});
 }
}
function buildWater(){const b=new Builder(),W=23.9,D=15.9,nx=56,nz=38;
 for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){
  const x1=-W/2+i*W/nx,x2=-W/2+(i+1)*W/nx,z1=-D/2+j*D/nz,z2=-D/2+(j+1)*D/nz;
  b.quad([x1,0,z1],[x2,0,z1],[x2,0,z2],[x1,0,z2],0x239ada);
 }
 return mesh(b);
}
function buildWake(){const b=new Builder();for(let k=0;k<3;k++){
  let rz=.55+k*.24,rx=.38+k*.2;
  for(let j=0;j<34;j++){
   const a=j*TWO_PI/34,c=(j+1)*TWO_PI/34;
   const p=th=>[rx*Math.cos(th),0,rz*Math.sin(th)];const aa=p(a),bb=p(c);
   const h=.013;b.quad([aa[0]*.95,0,aa[2]*.95],[bb[0]*.95,0,bb[2]*.95],[bb[0]*(1+h),0,bb[2]*(1+h)],[aa[0]*(1+h),0,aa[2]*(1+h)],k%2?0xcaf3ef:0xffffff);
  }
 }return mesh(b);}
function buildCrack(){const b=new Builder();b.box(0,0,0,.09,.02,.55,0x1a0c0d);
 // 3 mảnh ván nứt bật khỏi thân thuyền bị cọc chọc thủng.
 for(let i=0;i<5;i++){const x=(i-2)*.09,z=.13+(i%3)*.09;
 b.cylinder([x,0,z],[x+(.1-rnd()*.2),.19+rnd()*.17,z+.12],.035,.012,0x7a4e34,5);
 }
 return mesh(b);
}

function buildEffects(){
 const flame=new Builder();
 for(const [x,z,h,r] of [[0,0,1.7,.39],[-.29,.13,1.4,.28],[.27,-.14,1.37,.27],[.12,.3,1.05,.30]]){
  flame.cone([x,0,z],r,h,0xb52b0d,8,[0,1,.12]);
  flame.cone([x,.10,z],r*.68,h*.79,0xfa7d18,8,[0,1,.06]);
  flame.cone([x,.18,z],r*.36,h*.57,0xffd166,8,[0,1,.05]);
 }
 fireMesh=mesh(flame);
 const smoke=new Builder();
 for(const [x,y,z,r] of [[0,0,0,.43],[.19,.27,.10,.32],[-.15,.38,0,.34]])smoke.sphere([x,y,z],r,r*.82,r*.82,0x68707a,4,8);
 smokeMesh=mesh(smoke);
 const foam=new Builder();
 for(let i=0;i<22;i++){
  const a=i*TWO_PI/22,bb=(i+1)*TWO_PI/22;
  const p=r=>[r*Math.cos(a),0,r*Math.sin(a)],q=r=>[r*Math.cos(bb),0,r*Math.sin(bb)];
  foam.quad(p(.31),q(.31),q(.42),p(.42),i%3===0?0xd3f5e7:0x8ddef0);
 }
 foamyRing=mesh(foam);
 const debris=new Builder();debris.box(0,0,0,.3,.065,.73,0x80512a);debris.box(.09,.05,.15,.08,.07,.28,0x46301b);debrisMesh=mesh(debris);
}
function buildObjects(){buildBoard();buildIslands();buildStakes();buildArmies();buildArrows();buildShips();buildEffects();waterMesh=buildWater();wakeMesh=buildWake();crackMesh=buildCrack();}
let waterMesh,wakeMesh,crackMesh;
// Phân cảnh chiến thuật: ở đầu trận, quân ta đã ở sâu trong cửa sông (trái sa bàn),
// quân Nam Hán đang ở ngoài cửa sông (phải sa bàn).
// Thuyền nhẹ ĐI RA trước để khiêu chiến, QUAY LẠI để dụ địch đuổi theo.
// Khi triều xuống, quân Nam Hán tìm đường RÚT RA BIỂN nhưng mắc ở hàng cọc.
const route={
 standby:[
  [[-5.8,3.15],[-5.45,3.10]],
  [[-6.1,1.58],[-5.55,1.62]],
  [[8.35,2.2],[8.31,2.22]],
  [[9.4,.22],[9.35,.23]]
 ],
 sortie:[
  [[-5.45,3.10],[-3.0,3.25],[-.6,3.50],[1.40,3.36],[4.35,3.05]],
  [[-5.55,1.62],[-3.50,1.75],[-1.0,1.92],[1.25,2.02],[3.9,2.02]]
 ],
 lure:[
  [[4.35,3.05],[2.15,3.35],[-.5,3.45],[-2.30,3.12],[-4.3,3.25]],
  [[3.9,2.02],[1.8,2.00],[-.8,2.05],[-2.9,1.9],[-4.75,1.85]],
  [[8.31,2.22],[6.3,2.25],[3.1,2.40],[-.5,2.36],[-3.45,2.06]],
  [[9.35,.23],[7.3,.25],[4.8,.39],[1.3,.55],[-2.16,.66]]
 ],
 low:[
  [[-4.3,3.25],[-4.80,3.5],[-5.35,4.06],[-6.12,4.20],[-7.15,3.65]],
  [[-4.75,1.85],[-5.18,1.37],[-5.80,1.05],[-6.6,1.02],[-7.25,1.7]],
  [[-3.45,2.06],[-3.10,1.80],[-2.5,1.52],[-2.02,1.21],[-1.55,1.10]],
  [[-2.16,.66],[-1.83,.61],[-1.45,.54],[-.78,.38],[-.4,.30]]
 ]
};
function samplePath(path,t){t=clamp(t,0,1);const q=t*(path.length-1),i=Math.min(path.length-2,Math.floor(q)),u=q-i;
 const p0=path[Math.max(0,i-1)],p1=path[i],p2=path[i+1],p3=path[Math.min(path.length-1,i+2)];
 return [0,1].map(k=>.5*((2*p1[k])+(-p0[k]+p2[k])*u+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*u*u+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*u*u*u));
}

// Thời gian mô phỏng dài 60 giây: mọi đối tượng tính trực tiếp theo t,
// nên kéo thanh tua tiến hay tua lùi đều đảo ngược chính xác trạng thái.
const DURATION=60;
const sceneState={phase:'intro',time:0,duration:DURATION,tide:.36,paused:true,speed:1,view:'overview',lastTimestamp:0,frame:0,ambientTime:0,finished:false};
const orbit={az:-.12,el:.88,dist:27.6,target:[0,.28,0],
 desiredAz:-.12,desiredEl:.88,desiredDist:27.6,desiredTarget:[0,.28,0]};
const chapters=[
 {t:0,id:'intro',no:'00',tag:'TRẬN ĐỊA',title:'Sắp đặt trận địa trên sông Bạch Đằng',body:'Quân ta bố trí bãi cọc gỗ đầu bịt sắt, mai phục ở hai bờ; lựa chọn vị trí và thời cơ dựa theo thủy triều.',q:'Quan sát: Quân ta đặt các hàng cọc ở vị trí nào trong lòng sông?'},
 {t:7,id:'rising',no:'01',tag:'TRIỀU LÊN',title:'Triều dâng, quân ta tiến ra khiêu chiến',body:'Thuyền nhỏ quân ta từ phía trong cửa sông tiến ra phía ngoài trong khi đoàn thuyền Nam Hán còn chờ ở gần cửa biển. Bãi cọc đã bị nước che khuất.',q:'Câu hỏi: Khi mực nước cao, vì sao thuyền lớn có thể đi vào trận địa?'},
 {t:15,id:'turn',no:'02',tag:'GIẢ RÚT',title:'Thuyền quân ta quay đầu, giả rút',body:'Sau khi tiến ra khiêu chiến, hai thuyền nhẹ của quân ta quay đầu rút về phía trong cửa sông, đi theo lối đã chuẩn bị. Đội thuyền Nam Hán bắt đầu truy đuổi.',q:'Quan sát: Vì sao quân ta không giao chiến ngay mà quay đầu giả rút?'},
 {t:22,id:'lure',no:'03',tag:'NHỬ ĐỊCH',title:'Quân Nam Hán đuổi sâu vào trận địa',body:'Chiến thuyền Nam Hán tiếp tục đuổi theo đội thuyền nhẹ của quân ta, vượt khu vực bãi cọc lúc vẫn còn ngập nước.',q:'Điều gì khiến quân Nam Hán chưa nhận ra bãi cọc?'},
 {t:27,id:'ebb',no:'04',tag:'NƯỚC RÚT',title:'Thủy triều xuống — bãi cọc dần lộ ra',body:'Khi triều rút, các hàng cọc cố định hiện dần lên. Thuyền quân ta chủ động rút theo lối đã biết.',q:'Giải thích: Điều gì đã thay đổi khi nước rút — vị trí bãi cọc hay mực nước?'},
 {t:39,id:'escape',no:'05',tag:'PHẢN CÔNG',title:'Thuyền ta lách qua, thuyền địch khó xoay trở',body:'Thuyền nhỏ cơ động vượt khỏi trận địa; quân ta từ hai bờ phối hợp phản công, chặn đường rút của địch.',q:'So sánh: Vì sao thuyền nhỏ dễ xoay trở hơn những chiến thuyền lớn?'},
 {t:44,id:'impact',no:'06',tag:'MẮC CỌC',title:'Chiến thuyền Nam Hán va vào bãi cọc',body:'Nước rút nhanh làm thuyền lớn mắc cọc, thủng đáy và nghiêng. Quân địch bắt đầu mất khả năng cơ động.',q:'Quan sát điểm va chạm giữa thân thuyền và đầu cọc bịt sắt.'},
 {t:49,id:'fire',no:'07',tag:'THUYỀN CHÌM',title:'Tàu địch nghiêng, quân lính rơi xuống nước',body:'Trong trận phản công, một số quân địch ngã trên boong hoặc rơi xuống sông. Thuyền địch bị phá hỏng, chìm dần; ngọn lửa minh họa cảnh giao chiến.',q:'Kết luận: Vì sao chiến thuật nhử địch, lợi dụng thủy triều và phục kích phải kết hợp chặt chẽ?'},
 {t:57,id:'victory',no:'08',tag:'CHIẾN THẮNG',title:'Bạch Đằng năm 938 — chiến thắng lịch sử',body:'Quân Nam Hán thất bại. Chiến thắng do Ngô Quyền chỉ huy chấm dứt thời kì Bắc thuộc lâu dài và mở ra thời kì độc lập, tự chủ.',q:'Chốt kiến thức: Địa hình + thủy triều + bãi cọc + mưu lược và sự phối hợp của quân ta.'}
];
const dynamicObjects=[];
function activeChapter(t){let c=chapters[0];for(const x of chapters)if(t>=x.t)c=x;return c;}
let lastChapter='';
function syncChapter(){
 const t=sceneState.time,c=activeChapter(t);
 if(c.id===lastChapter)return;
 lastChapter=c.id;
 $('phaseNumber').textContent='GIAI ĐOẠN '+c.no;
 $('phaseTag').textContent=c.tag;$('storyTitle').textContent=c.title;
 $('storyBody').textContent=c.body;$('storyQuestion').textContent=c.q;
 $('timelineCurrentStage').textContent=c.tag;
 $('btnHigh').classList.toggle('active',t>=7&&t<27);
 $('btnLow').classList.toggle('active',t>=27);
 document.querySelectorAll('[data-seek]').forEach(b=>b.classList.toggle('active',Number(b.dataset.seek)===c.t));
}
function setView(view){sceneState.view=view;
 orbit.desiredTarget=view==='focus'?[-1.45,.64,1.20]:[0,.28,0];
 orbit.desiredAz=view==='focus'?-.37:-.12;
 orbit.desiredEl=view==='focus'?.76:.88;
 orbit.desiredDist=view==='focus'?(window.innerWidth<=750?23.5:16.9):(window.innerWidth<=750?39.0:27.6);
 $('btnOverview').classList.toggle('active',view==='overview');$('btnFocus').classList.toggle('active',view==='focus');
 $('stakeMarker').style.opacity=view==='focus'?'0':'1';
 $('stakeMarker').style.pointerEvents=view==='focus'?'none':'auto';
}
function timeLabel(t){t=Math.round(t);return String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');}
function syncTimeline(){
 const t=sceneState.time,p=Math.round(t/60*100);
 $('timelineRange').value=String(t);$('timeNow').textContent=timeLabel(t);
 $('timelineRange').style.background=`linear-gradient(90deg,#e5a15e ${p}%,#263f50 ${p}%)`;
 $('progressFill').style.width=p+'%';
 syncChapter();
}
function syncButtons(){
 const stopped=sceneState.paused;
 $('btnPause').innerHTML=stopped?'▶ <span>Tiếp tục</span>':'Ⅱ <span>Tạm dừng</span>';
 $('btnTimelinePlay').innerHTML=stopped?'▶ <span>Bắt đầu</span>':'Ⅱ <span>Tạm dừng</span>';
 $('btnTimelinePlay').setAttribute('aria-label',stopped?'Phát mô phỏng':'Tạm dừng mô phỏng');
}
function seek(t,autoPlay=false){
 sceneState.time=clamp(Number(t)||0,0,DURATION);
 sceneState.paused=!autoPlay;
 if(sceneState.time>=27&&sceneState.view!=='focus')setView('focus');
 sceneState.finished=sceneState.time>=DURATION;
 syncButtons();syncTimeline();updateSimulation(0);
 if(window.BachAudio)window.BachAudio.onSeek({time:sceneState.time,paused:sceneState.paused,speed:sceneState.speed});
}
function togglePlaying(){
 if(sceneState.time>=DURATION){sceneState.time=0;lastChapter='';}
 sceneState.paused=!sceneState.paused;syncButtons();syncTimeline();
 if(window.BachAudio)window.BachAudio.onTransport({time:sceneState.time,paused:sceneState.paused,speed:sceneState.speed});
}
function startHigh(){seek(7,true);setView('focus');}
function startLow(){seek(27,true);setView('focus');}
function reset(){seek(0,false);setView('overview');}
function placeBoat(boat,path,t,y,rockTime,scale=1){
 const u=clamp(t,0,1),p=samplePath(path,u),next=samplePath(path,Math.min(.999,Math.max(.002,u)+.005)),prev=samplePath(path,Math.max(.001,Math.min(.998,u)-.005));
 const dx=next[0]-prev[0],dz=next[1]-prev[1],yaw=Math.atan2(dx,dz);
 boat.pos=[p[0],y+.09+.019*Math.sin(rockTime*2+boat.id*2),p[1]];
 boat.angle=yaw;boat.roll=.016*Math.sin(rockTime*2.1+boat.id);boat.pitch=.011*Math.sin(rockTime*2.5+boat.id*.8);boat.scale=scale;boat.hit=0;
}
function addDynamic(objMesh,position,angle=0,roll=0,pitch=0,scale=1,alpha=1,pass='opaque'){
 if(objMesh&&alpha>.008)dynamicObjects.push({mesh:objMesh,model:modelMatrix(position,angle,roll,pitch,scale),opacity:clamp(alpha,0,1),pass});
}
function getBoatPoint(b,at){return pointByModel(at,modelMatrix(b.pos,b.angle,b.roll,b.pitch,b.scale));}
function addCrew(t){
 for(const member of crew){
  const b=boats[member.ship];
  if(member.side==='friendly'){
   const v=getBoatPoint(b,member.at);
   addDynamic(meshFriendly,v,b.angle,0,0,.48);
   continue;
  }
  let event=member.event,fate=member.fate||'none';
  if(fate==='none'||t<event){
   addDynamic(meshEnemy,getBoatPoint(b,member.at),b.angle,0,0,.57);
  }else if(fate==='deck'){
   const p=smooth((t-event)/1.35);
   let local=[member.at[0]+p*.13,member.at[1]-.06*p,member.at[2]+p*.06];
   addDynamic(meshEnemyDown,getBoatPoint(b,local),b.angle,b.angle?(-p*1.35):(-p*1.35),.15*p,.55);
  }else{
   const p=smooth((t-event)/3.1);
   const left=fate==='overboard-left',side=left?-1:1;
   const from=getBoatPoint(b,member.at);
   const end=[from[0]+side*1.43,sceneState.tide+.04,from[2]+(left?-.37:.85)];
   const fallP=smooth((t-event)/2.1);
   if(t<event+2.1){
    const a=[mix(from[0],end[0],fallP),mix(from[1],end[1],fallP)+.23*Math.sin(Math.PI*fallP),mix(from[2],end[2],fallP)];
    addDynamic(meshEnemy,a,b.angle+fallP*.4,side*fallP*1.22,fallP*.36,.56);
   }else{
    // Người rơi xuống sông được mô phỏng không có chi tiết bạo lực.
    const waterMotion=t>=DURATION?sceneState.ambientTime+60:t;
    const at=[end[0]+.12*Math.sin(waterMotion*.47+member.ship),sceneState.tide+.025,end[2]+.09*Math.cos(waterMotion*.6)];
    addDynamic(meshEnemySwimming,at,0,0,0,.77);
    addDynamic(foamyRing,[at[0],sceneState.tide+.08,at[2]],0,0,0,.40,.71,'transparent');
   }
  }
 }
}
function addBattleEffects(t){
 // Mảnh gỗ văng ra ở điểm va chạm; từ giây 44.5 trở đi.
 const impact=smooth((t-44.0)/3.1),b=boats[2];
 if(impact>.02){
  addDynamic(crackMesh,getBoatPoint(b,[0,-.09,.63]),b.angle,0,0,1,impact);
  for(let i=0;i<4;i++){
   let phase=Math.max(0,t-45-i*.38),fly=clamp(phase/3,0,1);
   const pos=getBoatPoint(b,[(i-2)*.27, .15, .35]);
   addDynamic(debrisMesh,[pos[0]+(i-1.4)*fly*.72,pos[1]+.5*Math.sin(Math.PI*fly),pos[2]+fly*.8],t*.2+i,fly*.8,fly*.3,.62,.95,'opaque');
  }
 }
 // Các chùm lửa riêng biệt khi trận đánh diễn ra, cộng khói bốc lên.
 const strength=smooth((t-47.0)/4.0)*(1-.18*smooth((t-56)/4));
 const fxTime=t>=DURATION?sceneState.ambientTime+60:t;
 if(strength>.01){
  for(const [index,loc] of [[2,[.19,.51,.32]],[2,[-.24,.52,-.8]],[3,[.13,.50,-.2]]]){
   const ship=boats[index],factor=index===3?.65:1;
   const pos=getBoatPoint(ship,loc);pos[1]=Math.max(pos[1],sceneState.tide+.17);
   const wiggle=Math.sin(fxTime*5.1+index+loc[2])*.12;
   addDynamic(fireMesh,[pos[0],pos[1]-.04,pos[2]],fxTime*.15+wiggle,0,0,(.47+.14*Math.sin(fxTime*7))*strength*factor,1,'transparent');
   // khói dạng các cụm mây nhỏ di chuyển khi thời gian tiến lên (tua ngược sẽ thu lại)
   for(let j=0;j<4;j++){
    const travel=((Math.max(0,fxTime-48)+j*.94)%5)/5;
    addDynamic(smokeMesh,[pos[0]+travel*.42,pos[1]+.60+travel*2.15,pos[2]-travel*.35],fxTime*.15+j,0,0,(.27+travel*.34)*strength*factor,.37*(1-travel),'transparent');
   }
  }
 }
 if(t>43){
  const sp=smooth((t-43)/5);
  const at=getBoatPoint(b,[0,0,.50]);
  addDynamic(foamyRing,[at[0],sceneState.tide+.07,at[2]],t*.01,0,0,1.4+sp*.65,.55,'transparent');
 }
}
function updateSimulation(dt){
 const s=sceneState;
 s.ambientTime+=Math.max(0,dt);
 if(!s.paused&&dt>0){s.time=Math.min(DURATION,s.time+dt*s.speed);if(s.time>=DURATION){s.paused=true;s.finished=true;syncButtons();}}
 const t=s.time;
 if(t<=7)s.tide=mix(.36,1.20,smooth(t/7));
 else if(t<=25)s.tide=1.20;
 else if(t<44)s.tide=mix(1.20,.33,smooth((t-25)/19));
 else s.tide=.33;
 // 0–8: quân địch đứng ngoài, thuyền ta chờ trong sông.
 // 8–15: thuyền ta tiến RA cửa sông để khiêu chiến, địch vẫn chưa tiến vào.
 // 15–25: thuyền ta GIẢ RÚT vào trong, quân Nam Hán đuổi theo.
 // 25–44: triều rút, thuyền địch QUAY RA biển nhưng mắc cọc; quân ta thoát theo lối biết trước.
 for(let i=0;i<4;i++){
  const scale=i===3?.91:1;
  if(t<8){placeBoat(boats[i],route.standby[i],0,s.tide,s.ambientTime,scale);}
  else if(t<15){
   if(i<2)placeBoat(boats[i],route.sortie[i],smooth((t-8)/7),s.tide,s.ambientTime,scale);
   else placeBoat(boats[i],route.standby[i],0,s.tide,s.ambientTime,scale);
  } else if(t<25){
   placeBoat(boats[i],route.lure[i],smooth((t-(i<2?15:16.2))/(i<2?10:8.8)),s.tide,s.ambientTime,scale);
  }else{
   let p=smooth((t-(i<2?27:29.0))/(i<2?14:15));
   if(i===2)p=Math.min(.99,p);
   if(i===3)p=Math.min(.94,p);
   placeBoat(boats[i],route.low[i],p,s.tide,s.ambientTime,scale);
  }
 }
 const impact=smooth((t-43.0)/4.3);
 const sinking=smooth((t-47)/13);
 const main=boats[2],other=boats[3];
 main.hit=impact;
 main.roll+=.34*impact+.44*sinking;
 main.pitch-=.14*impact+.15*sinking;
 main.pos[1]-=.20*impact+1.05*sinking;
 other.hit=impact*.62;
 other.roll+=.16*impact+.22*sinking;
 other.pitch-=.07*impact;
 other.pos[1]-=.15*impact+.48*sinking;
 // Sau khi phim kết thúc, vẫn cho mặt nước và thân tàu dao động rất nhẹ;
 // không tiếp tục đẩy thuyền chìm sâu vô hạn.
 if(t>=DURATION){
  for(const boat of boats){boat.pos[1]+=.014*Math.sin(s.ambientTime*2.2+boat.id);}
 }
 dynamicObjects.length=0;
 addCrew(t);addBattleEffects(t);
 const meter=clamp((s.tide-.33)/.87,0,1);
 $('meterFill').style.width=Math.round(meter*100)+'%';
 $('meterLabel').textContent=meter>.77?'CAO':meter>.3?'ĐANG ĐỔI':'THẤP';
 syncTimeline();
}
function updateOrbit(dt){let t=1-Math.exp(-dt*6.4);
 orbit.az+= (orbit.desiredAz-orbit.az)*t;
 orbit.el+= (orbit.desiredEl-orbit.el)*t;
 orbit.dist+=(orbit.desiredDist-orbit.dist)*t;
 orbit.target=orbit.target.map((v,i)=>v+(orbit.desiredTarget[i]-v)*t);
 const eye=[orbit.target[0]+orbit.dist*Math.cos(orbit.el)*Math.sin(orbit.az),orbit.target[1]+orbit.dist*Math.sin(orbit.el),orbit.target[2]+orbit.dist*Math.cos(orbit.el)*Math.cos(orbit.az)];
 vp=multiply(perspective(window.innerWidth<=750?1.10:.78,width/Math.max(height,1),.1,200),lookAt(eye,orbit.target));
}

function render(time){
 if(fallback2D){renderCanvas3D(time);return;}
 if(!gl)return;
 gl.viewport(0,0,canvas.width,canvas.height);
 gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(shader);
 gl.uniformMatrix4fv(uni.vp,false,vp);gl.uniform1f(uni.time,time);
 gl.disable(gl.BLEND);gl.depthMask(true);
 for(const obj of opaque)draw(obj);
 for(const boat of boats)draw(boat.mesh,modelMatrix(boat.pos,boat.angle,boat.roll,boat.pitch,boat.scale));
 for(const obj of dynamicObjects)if(obj.pass==='opaque')draw(obj.mesh,obj.model,1);
 gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
 draw(waterMesh,modelMatrix([0,sceneState.tide,0]),sceneState.tide>.83?.955:.84,1);
 draw(arrowMesh,modelMatrix([0,sceneState.tide+.11,0]),.93);
 const tactical=tacticalAtTime();
 if(tactical)draw(tactical.mesh,modelMatrix([0,sceneState.tide+.145,0]),.92+.08*Math.sin(time*3.2));
 for(const boat of boats){
  if(sceneState.time<=7)continue;
  draw(wakeMesh,modelMatrix([boat.pos[0],sceneState.tide+.06,boat.pos[2]],boat.angle,0,0,boat.kind==='enemy'?1.17:.64),.2);
 }
 for(const obj of dynamicObjects)if(obj.pass==='transparent')draw(obj.mesh,obj.model,obj.opacity);
 gl.depthMask(true);gl.disable(gl.BLEND);
}
/*
  3D Canvas dự phòng: dựng từ các tam giác tọa độ 3D thật và sắp xếp theo chiều sâu.
  Không phải ảnh tĩnh hay 2D có sẵn: thao tác kéo/zoom đổi ma trận camera của sa bàn.
  Chế độ này hoạt động khi máy tính chặn WebGL, kể cả khi shader không liên kết được.
*/
function triFromRaw(raw,triangle){
 const start=triangle*27;
 const p=[];
 for(let j=0;j<3;j++)p.push([raw[start+j*9],raw[start+j*9+1],raw[start+j*9+2]]);
 return {p, color:[raw[start+6],raw[start+7],raw[start+8]]};
}
function parseMesh(raw,stride=1,max=18000){
 if(!raw)return [];
 const total=raw.length/27;
 const faces=[];
 for(let i=0;i<total&&faces.length<max;i+=stride)faces.push(triFromRaw(raw,i));
 return faces;
}
function prepareFallback3D(){
 fallbackFaces=[];
 for(const [i,obj] of opaque.entries()){
  const tris=obj.raw.length/27;
  // Những búi rêu/chùm cây dùng mẫu đơn giản hóa để máy cấu hình thấp chạy ổn định.
  const stride=i===3?1:((tris>5500)?Math.max(3,Math.ceil(tris/3100)):1);
  const parsed=parseMesh(obj.raw,stride);
  // Không vẽ các tam giác mặt trên/dưới quá lớn của tấm đế trong Canvas:
  // trình vẽ painter không có depth buffer, một tam giác đế lớn sẽ che cả thuyền.
  // Mặt nước đã được chia ô và vẽ riêng nên vẫn nhìn thấy đúng sa bàn.
  fallbackFaces.push(...(i===0?parsed.filter(f=>{
   const xs=f.p.map(q=>q[0]),zs=f.p.map(q=>q[2]);
   return !(Math.max(...xs)-Math.min(...xs)>20 && Math.max(...zs)-Math.min(...zs)>12);
  }):parsed));
 }
 for(const boat of boats)boat.fallbackFaces=parseMesh(boat.mesh.raw,1);
 fallbackFaces.forEach(face=>{
  let n=norm(cross(sub(face.p[1],face.p[0]),sub(face.p[2],face.p[0])));
  const light=Math.abs(dot(n,norm([-.55,1,.4])));
  face.shade=.74+.34*light;
 });
}
function pointByModel(point,m){return [
 m[0]*point[0]+m[4]*point[1]+m[8]*point[2]+m[12],
 m[1]*point[0]+m[5]*point[1]+m[9]*point[2]+m[13],
 m[2]*point[0]+m[6]*point[1]+m[10]*point[2]+m[14]
];}
function cameraVector(){const ca=Math.cos(orbit.az),sa=Math.sin(orbit.az),ce=Math.cos(orbit.el),se=Math.sin(orbit.el);
 return [orbit.dist*ce*sa,orbit.dist*se,orbit.dist*ce*ca];}
function renderCanvas3D(time){
 if(!ctx2D||!width||!height)return;
 const ctx=ctx2D,deviceScale=canvas.width/width;
 ctx.setTransform(deviceScale,0,0,deviceScale,0,0);
 const sky=ctx.createLinearGradient(0,0,0,height);
 sky.addColorStop(0,'#113047');sky.addColorStop(.62,'#24485a');sky.addColorStop(1,'#244b52');
 ctx.fillStyle=sky;ctx.fillRect(0,0,width,height);
 // Hào quang nhẹ quanh sa bàn, giúp phân biệt rõ mép tấm xốp khi xoay.
 const cx=width*.52,cy=height*.49;
 const glow=ctx.createRadialGradient(cx,cy,20,cx,cy,Math.max(width,height)*.52);
 glow.addColorStop(0,'rgba(123,186,193,0.11)');glow.addColorStop(1,'rgba(2,22,35,0)');
 ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
 const sight=cameraVector(),dir=norm(mul(sight,-1));
 const faces=[];
 function pushFace(p,color,alpha=1,light=1){
  let center=[(p[0][0]+p[1][0]+p[2][0])/3,(p[0][1]+p[1][1]+p[2][1])/3,(p[0][2]+p[1][2]+p[2][2])/3];
  let a=project(p[0],vp,width,height),b=project(p[1],vp,width,height),c=project(p[2],vp,width,height);
  if(!a||!b||!c)return;
  if(Math.max(a.x,b.x,c.x)<-10||Math.min(a.x,b.x,c.x)>width+10||Math.max(a.y,b.y,c.y)<-10||Math.min(a.y,b.y,c.y)>height+10)return;
  const area=Math.abs((b.x-a.x)*(c.y-a.y)-(c.x-a.x)*(b.y-a.y));
  if(area<.11)return;
  const depth=dot(center,dir);
  faces.push({a,b,c,color,alpha,light,depth});
 }
 for(const f of fallbackFaces)pushFace(f.p,f.color,1,f.shade);
 // Nước được chia thành nhiều mảnh nhỏ để bảo đảm thứ tự che khuất bãi cọc/đảo.
 const tilesX=22,tilesZ=14;
 for(let i=0;i<tilesX;i++)for(let j=0;j<tilesZ;j++){
  const x1=-11.94+i*23.88/tilesX,x2=-11.94+(i+1)*23.88/tilesX;
  const z1=-7.94+j*15.88/tilesZ,z2=-7.94+(j+1)*15.88/tilesZ;
  const waterY=(x,z)=>sceneState.tide+.022*Math.sin(x*1.65+time*1.5)+.014*Math.cos(z*2.1-time*1.0);
  const p1=[x1,waterY(x1,z1),z1],p2=[x2,waterY(x2,z1),z1],p3=[x2,waterY(x2,z2),z2],p4=[x1,waterY(x1,z2),z2];
  const surf=.92+.06*Math.sin(i*.71+j*.9+time*.35);
  const co=[.09*surf,.55*surf,.83*surf];
  const alpha=sceneState.tide>.87?.91:.82;
  pushFace([p1,p2,p3],co,alpha,1);pushFace([p1,p3,p4],co,alpha,1);
 }
 // Các mũi tên định hướng giấy nổi theo mặt nước, giống sa bàn thủ công.
 if(arrowMesh&&arrowMesh.raw){
  const m=modelMatrix([0,sceneState.tide+.12,0]);
  const tri=arrowMesh.raw.length/27;
  for(let i=0;i<tri;i++){
   const face=triFromRaw(arrowMesh.raw,i);
   pushFace(face.p.map(p=>pointByModel(p,m)),face.color,1,1.16);
  }
 }
 // Mũi tên đỏ có hướng thay đổi theo thời gian, được dựng trong cả WebGL và Canvas dự phòng.
 const tactical=tacticalAtTime();
 if(tactical&&tactical.mesh&&tactical.mesh.raw){
  const m=modelMatrix([0,sceneState.tide+.153,0]);
  const tri=tactical.mesh.raw.length/27;
  const alpha=.94+.06*Math.sin(time*3.2);
  for(let i=0;i<tri;i++){
   const face=triFromRaw(tactical.mesh.raw,i);
   pushFace(face.p.map(p=>pointByModel(p,m)),face.color,alpha,1.24);
  }
 }
 for(const boat of boats){
  const model=modelMatrix(boat.pos,boat.angle,boat.roll,boat.pitch,boat.scale);
  for(const f of boat.fallbackFaces){pushFace(f.p.map(p=>pointByModel(p,model)),f.color,1,1.04);}
 }

 // Nhân vật tách riêng, mảnh gỗ, lửa và khói đều xuất hiện cả trong Canvas dự phòng.
 for(const obj of dynamicObjects){
  if(!obj.mesh.raw)continue;
  const raw=obj.mesh.raw,tri=raw.length/27;
  for(let i=0;i<tri;i++){
   const face=triFromRaw(raw,i);
   pushFace(face.p.map(p=>pointByModel(p,obj.model)),face.color,obj.opacity,obj.pass==='transparent'?1.15:1.04);
  }
 }
 faces.sort((a,b)=>b.depth-a.depth);
 let lastFill='',lastAlpha=-1;
 for(const f of faces){
  const r=clamp(Math.round(f.color[0]*f.light*255),0,255),g=clamp(Math.round(f.color[1]*f.light*255),0,255),b=clamp(Math.round(f.color[2]*f.light*255),0,255);
  const color=`rgb(${r},${g},${b})`;
  if(color!==lastFill){ctx.fillStyle=color;lastFill=color;}
  if(f.alpha!==lastAlpha){ctx.globalAlpha=f.alpha;lastAlpha=f.alpha;}
  ctx.beginPath();ctx.moveTo(f.a.x,f.a.y);ctx.lineTo(f.b.x,f.b.y);ctx.lineTo(f.c.x,f.c.y);ctx.closePath();ctx.fill();
 }
 ctx.globalAlpha=1;
}

const anchors={banner:[-8.1,2.55,-5.95],giao:[-9.95,1.55,6.45],luc:[5.5,1.65,-6.2],cat:[9.6,1.81,5.25],vinh:[6.0,.62,-.05],stake:[-1.8,1.7,1.12]};
function updateLabels(){for(const node of document.querySelectorAll('[data-anchor]')){
 const point=anchors[node.dataset.anchor],p=project(point,vp,width,height);
 if(!p||!p.visible||p.x<-90||p.x>width+90||p.y<-120||p.y>height+90){node.style.display='none';continue;}
 node.style.display='block';node.style.left=`${p.x}px`;node.style.top=`${p.y}px`;
 }
 const badge=$('redRouteBadge'), tactical=tacticalAtTime();
 if(!tactical){badge.hidden=true;return;}
 const point=project([tactical.endpoint[0],sceneState.tide+.52,tactical.endpoint[1]],vp,width,height);
 if(!point||!point.visible||point.x<25||point.x>width-25||point.y<90||point.y>height-95){badge.hidden=true;return;}
 badge.hidden=false;
 badge.style.left=`${point.x}px`;
 badge.style.top=`${point.y-12}px`;
 $('redRouteText').textContent=tactical.label;
}
function resize(){const dpr=Math.min(devicePixelRatio||1, fallback2D?1:1.8);width=app.clientWidth;height=app.clientHeight;
 canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
 canvas.style.width=width+'px';canvas.style.height=height+'px';}
function openStakeInfo(){
 setView('focus');
 const modal=$('stakeDialog');modal.hidden=false;
 const section=modal.querySelector('.stake-dialog');if(section)section.focus();
}
function closeStakeInfo(){ $('stakeDialog').hidden=true; }
function setCollapsed(id,collapsed){
 const panel=$(id);if(!panel)return;
 panel.classList.toggle('is-collapsed',collapsed);
 if(id==='legendPanel'){const rail=document.querySelector('.right-rail');if(rail)rail.classList.toggle('legend-expanded',!collapsed);}
 const button=panel.querySelector('.collapse-toggle');
 if(button){button.setAttribute('aria-expanded',String(!collapsed));button.setAttribute('aria-label',(collapsed?'Mở rộng ':'Thu gọn ')+ (id==='storyPanel'?'thông tin giai đoạn':id==='legendPanel'?'chú giải':'bảng điều khiển'));button.innerHTML=collapsed?'+ <span>Mở ra</span>':'− <span>Thu gọn</span>';}
}
function bindUI(){
 document.querySelectorAll('[data-collapse]').forEach(btn=>btn.addEventListener('click',()=>{
  const id=btn.dataset.collapse,next=!$(id).classList.contains('is-collapsed');
  if(!next&&window.innerWidth<=750){for(const other of ['storyPanel','controlPanel','legendPanel'])if(other!==id)setCollapsed(other,true);}
  setCollapsed(id,next);
 }));
 if(window.innerWidth<=750){for(const id of ['storyPanel','controlPanel','legendPanel'])setCollapsed(id,true);}
 $('closeStakeDialog').addEventListener('click',closeStakeInfo);
 $('closeAndFocus').addEventListener('click',closeStakeInfo);
 $('stakeDialog').addEventListener('click',e=>{if(e.target===$('stakeDialog'))closeStakeInfo();});
 $('btnClean').addEventListener('click',()=>{const active=document.body.classList.toggle('clean-view');$('btnClean').textContent=active?'⊞ Hiện bảng thông tin':'⛶ Chế độ trình chiếu';});
 $('btnOverview').addEventListener('click',()=>setView('overview'));
 $('btnFocus').addEventListener('click',openStakeInfo);
 $('btnHigh').addEventListener('click',startHigh);$('btnLow').addEventListener('click',startLow);
 $('btnReset').addEventListener('click',reset);
 $('btnTimelinePlay').addEventListener('click',togglePlaying);
 $('btnTimelineRestart').addEventListener('click',reset);
 $('timelineRange').addEventListener('input',e=>seek(e.target.value,false));
 document.querySelectorAll('[data-seek]').forEach(b=>b.addEventListener('click',()=>seek(b.dataset.seek,false)));
 $('btnPause').addEventListener('click',togglePlaying);
 $('btnSpeed').addEventListener('click',()=>{const steps=[1,1.5,2],i=steps.indexOf(sceneState.speed);sceneState.speed=steps[(i+1)%3];$('btnSpeed').innerHTML=`◷ <span>${sceneState.speed}×</span>`;if(window.BachAudio)window.BachAudio.onSpeed(sceneState.speed);});
 $('stakeMarker').addEventListener('click',openStakeInfo);
 const pointers=new Map();let pointerDown=null,lastPinchDistance=0;
 canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);
  if(pointers.size===1)pointerDown=[e.clientX,e.clientY];
  if(pointers.size===2)lastPinchDistance=0;});
 canvas.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId)){
   const p=project(anchors.stake,vp,width,height);canvas.style.cursor=p&&Math.hypot(e.offsetX-p.x,e.offsetY-p.y)<82?'pointer':'grab';return;
  }
  const prev=pointers.get(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);
  if(pointers.size===1){const dx=e.clientX-prev[0],dy=e.clientY-prev[1];orbit.desiredAz-=dx*.008;
   orbit.desiredEl=clamp(orbit.desiredEl+dy*.006,.22,1.46);}
  else if(pointers.size===2){const p=Array.from(pointers.values());let distance=Math.hypot(p[0][0]-p[1][0],p[0][1]-p[1][1]);
   if(lastPinchDistance>0)orbit.desiredDist=clamp(orbit.desiredDist*(lastPinchDistance/distance),5.2,39);
   lastPinchDistance=distance;}
 });
 canvas.addEventListener('pointerup',e=>{if(pointerDown&&pointers.size===1&&Math.hypot(e.clientX-pointerDown[0],e.clientY-pointerDown[1])<8){
  const p=project(anchors.stake,vp,width,height);
  if(p&&Math.hypot(e.offsetX-p.x,e.offsetY-p.y)<90*Math.min(1.5,25/orbit.dist))openStakeInfo();
 }
 pointers.delete(e.pointerId);pointerDown=null;lastPinchDistance=0;});
 canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);pointerDown=null;lastPinchDistance=0;});
 canvas.addEventListener('wheel',e=>{e.preventDefault();orbit.desiredDist=clamp(orbit.desiredDist*Math.exp(e.deltaY*.0009),5.2,42);},{passive:false});
 canvas.addEventListener('dblclick',e=>{e.preventDefault();setView('overview');});
 window.addEventListener('resize',()=>{resize();setView(sceneState.view);});
 window.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('stakeDialog').hidden)closeStakeInfo();else setView('overview');}if(e.key.toLowerCase()==='f')$('btnClean').click();if(e.key===' '&&e.target.tagName!=='BUTTON'&&e.target.tagName!=='INPUT'){e.preventDefault();togglePlaying();}});
}
let running=false;
function frame(ts){if(!running)return;
 let dt=sceneState.lastTimestamp?clamp((ts-sceneState.lastTimestamp)/1000,0,.06):.016;sceneState.lastTimestamp=ts;
 updateSimulation(dt);updateOrbit(dt);
 if(window.BachAudio)window.BachAudio.onFrame({time:sceneState.time,paused:sceneState.paused,speed:sceneState.speed,finished:sceneState.finished});
 const seconds=sceneState.ambientTime;
 if(!fallback2D||ts-lastFallbackFrame>46){render(seconds);lastFallbackFrame=ts;}
 if(sceneState.frame++%2===0)updateLabels();
 if(sceneState.frame===2){feedback.classList.add('hidden');setTimeout(()=>{feedback.style.display='none';},550);}
 requestAnimationFrame(frame);
}
function showError(e){console.error('[Bạch Đằng 938]',e);$('errorOverlay').hidden=false;$('errorText').textContent=e&&e.message?e.message:String(e);feedback.style.display='none';}
function launch(){try{
 try{
  if(window.__BACH_FORCE_CANVAS__) throw new Error('Đang kiểm thử Canvas 3D');
  initGL();
 } catch(webglProblem) {
  console.warn('[Bạch Đằng 938] Chuyển sang chế độ 3D tương thích:',webglProblem.message);
  fallback2D=true;gl=null;
  const backup=canvas.cloneNode(false);
  canvas.replaceWith(backup);
  canvas=backup;
  ctx2D=canvas.getContext('2d',{alpha:false});
  if(!ctx2D) throw new Error('Trình duyệt không hỗ trợ cả WebGL lẫn Canvas 2D.');
  const edition=document.querySelector('.edition');
  if(edition)edition.textContent='3D TƯƠNG THÍCH • OFFLINE';
  const mark=$('rendererMode');if(mark)mark.textContent='Canvas 3D tương thích · Offline';
  feedback.textContent='Đang dựng sa bàn bằng chế độ 3D tương thích…';
 }
 buildObjects();
 if(!fallback2D&&$('rendererMode'))$('rendererMode').textContent='WebGL 3D · Offline';
 if(fallback2D)prepareFallback3D();
 bindUI();resize();reset();running=true;requestAnimationFrame(frame);}
 catch(e){showError(e);}}
launch();
})();


/* V7 · FIX BẢNG DIỄN BIẾN: giữ bảng nằm phía trên timeline */
(function keepStoryAboveTimeline(){
  const story = document.getElementById('storyPanel');
  const timeline = document.querySelector('.timeline-panel');
  const heading = document.querySelector('.masthead');
  if (!story || !timeline || !heading) return;
  let scheduled = false;
  function positionStory(){
    scheduled = false;
    // Bố cục điện thoại đã đặt bảng ở phần trên; không thay đổi.
    if (window.matchMedia('(max-width: 750px)').matches) {
      story.style.removeProperty('bottom');
      story.style.removeProperty('max-height');
      story.style.removeProperty('overflow-y');
      return;
    }
    const timeTop = timeline.getBoundingClientRect().top;
    const headingBottom = heading.getBoundingClientRect().bottom;
    const gap = 18; // Khoảng cách giữa bảng nội dung và thanh thời gian
    story.style.bottom = Math.ceil(window.innerHeight - timeTop + gap) + 'px';
    // Màn hình thấp: giữ phần bảng không che tiêu đề và cho cuộn trong bảng.
    const room = Math.max(112, Math.floor(timeTop - headingBottom - 18));
    story.style.maxHeight = room + 'px';
    story.style.overflowY = 'auto';
  }
  function scheduleStory(){
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(positionStory);
  }
  window.addEventListener('resize', scheduleStory, {passive:true});
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(scheduleStory);
    observer.observe(timeline);
  }
  scheduleStory();
})();
