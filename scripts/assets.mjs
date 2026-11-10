import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const sharp=require('sharp');
const root=new URL('../',import.meta.url).pathname;
const atlas=root+'art/source/hero-atlas.png';
const bg=root+'art/source/background-atlas.png';
const {data,info}=await sharp(atlas).raw().toBuffer({resolveWithObject:true});
const w=info.width,h=info.height,seen=new Uint8Array(w*h),components=[];
for(let start=0;start<w*h;start++){
 if(seen[start]||data[start*4+3]<150)continue;
 const q=[start];seen[start]=1;
 let xmin=w,xmax=0,ymin=h,ymax=0;
 for(let k=0;k<q.length;k++){
  const p=q[k],x=p%w,y=Math.floor(p/w);
  xmin=Math.min(xmin,x);xmax=Math.max(xmax,x);ymin=Math.min(ymin,y);ymax=Math.max(ymax,y);
  for(const i of [p-w,p+w,p-1,p+1])if(i>=0&&i<w*h&&!seen[i]&&data[i*4+3]>=150){seen[i]=1;q.push(i);}
 }
 if(q.length>1000)components.push({q,xmin,xmax,ymin,ymax});
}
components.sort((a,b)=>a.xmin-b.xmin);
const metadata={source:'Generated pixel art from supplied photographic and style references.',alphaPreparation:'Largest connected components at alpha >=150; output pixels use hard 0/255 alpha.',sprites:{},backgrounds:{}};
const names=['hero-idle','hero-down','hero-up','hero-win'];
for(let n=0;n<components.length;n++){
 const c=components[n],left=c.xmin-2,top=75,width=c.xmax-c.xmin+5,height=740;
 const raw=Buffer.alloc(width*height*4);
 for(const p of c.q){
  const x=p%w-left,y=Math.floor(p/w)-top;if(x<0||x>=width||y<0||y>=height)continue;
  const o=(y*width+x)*4;raw[o]=data[p*4];raw[o+1]=data[p*4+1];raw[o+2]=data[p*4+2];raw[o+3]=255;
 }
 await sharp(raw,{raw:{width,height,channels:4}}).png({compressionLevel:9}).toFile(root+'public/assets/'+names[n]+'.png');
 metadata.sprites[names[n]]={width,height,sourceLeft:left,sourceTop:top,baseline:737,bodyTop:c.ymin-top};
 if(n===0){
  for(const [name,region] of [
   ['hero-upper',{left:0,top:0,width,height:445}],
   ['hero-leg-left',{left:0,top:445,width:165,height:295}],
   ['hero-leg-right',{left:165,top:445,width:width-165,height:295}]
  ]){
   await sharp(raw,{raw:{width,height,channels:4}}).extract(region).png({compressionLevel:9}).toFile(root+'public/assets/'+name+'.png');
   metadata.sprites[name]={...region,anchorInFull:{x:region.left,y:region.top}};
  }
 }
}
for(const [name,top] of [['shop',0],['gym',701]]){
 await sharp(bg).extract({left:0,top,width:1122,height:701}).png({compressionLevel:9}).toFile(root+'public/assets/'+name+'.png');
 metadata.backgrounds[name]={width:1122,height:701};
}
await fs.writeFile(root+'public/assets/metadata.json',JSON.stringify(metadata,null,2));
console.log(JSON.stringify(metadata,null,2));
