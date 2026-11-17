const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();
for(const [m,w,h] of [['cover',660,440],['menu',340,660],['book',340,660],['done',340,660],['admin',340,660]]){
 const p=await b.newPage({viewport:{width:w,height:h},deviceScaleFactor:2});
 await p.goto('file://'+__dirname+'/render.html#'+m);await p.waitForTimeout(200);
 await p.screenshot({path:__dirname+'/'+m+'.png'});await p.close();}
await b.close()})();
