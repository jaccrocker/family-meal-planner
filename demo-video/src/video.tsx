import React from 'react';
import {AbsoluteFill,Audio,Freeze,Img,OffthreadVideo,Sequence,interpolate,spring,staticFile,useCurrentFrame,useVideoConfig} from 'remotion';
import {ArrowUpRight,BellRing,BrainCircuit,CalendarClock,Calculator,CheckCircle2,ChevronLeft,ChevronRight,createLucideIcon,Lock,MailCheck,ShieldCheck,ShoppingCart,Smartphone,Sparkles,Users,UtensilsCrossed} from 'lucide-react';
import telemetry from '../public/clips/telemetry.json';
import editMap from '../public/clips/edit-map.json';
import focusPoints from '../public/clips/focus-points.json';
import {scenes} from '../scenes.mjs';
import {detailVisibility} from '../alternative-camera.mjs';
import privacy from '../alternative-privacy.json';

type CaptureData={readmeImage?:string;directory:string;telemetry:typeof telemetry;editMap:{scene:string;parts:{fromMs:number;host:string;view?:string;profile?:string}[]}[];focusPoints:typeof focusPoints};
const CaptureContext=React.createContext<CaptureData>({directory:'clips',telemetry,editMap,focusPoints});
const useCapture=()=>React.useContext(CaptureContext);
const ink='#f8f6ee',muted='#b5c5b9',green='#c6efb0',gold='#edc186';
const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;
// Lucide 1.x omits brand exports; retain the GitHub symbol with its icon factory.
const Github=createLucideIcon('Github',[
  ['path',{d:'M9 19c-4.3 1.4-4.3-2.5-6-3m12 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 19 4.77 5.07 5.07 0 0 0 18.91 1S17.73.65 15 2.48a13.38 13.38 0 0 0-7 0C5.27.65 4.09 1 4.09 1A5.07 5.07 0 0 0 4 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 8 18.13V22',key:'github'}],
]);
const captions=[
  {from:0,to:10,icon:CalendarClock,kicker:'THE SUNDAY PROBLEM',text:'Every Sunday: 1 hour lost turning meal ideas into a family grocery list.'},
  {from:10,to:20,icon:Sparkles,kicker:'FIVE STEPS. ONE FINISHED WEEK.',text:'Family Meal Planner does that hour for you in 5 steps.'},
  {from:20,to:30,icon:Users,kicker:'PORTION-AWARE SCALING',text:'Adults = 1x. Younger Kids = 0.5x. Teens = 0.75x.'},
  {from:30,to:40,icon:ShieldCheck,kicker:'SHARED HOUSEHOLD',text:'Other adults sign in with Google to view the same plan.'},
  {from:40,to:56,icon:UtensilsCrossed,kicker:'YOUR WEEK. YOUR MEALS.',text:'Start Blank, Pick from 33 Favorites, or Type Any Meal in Plain Words.'},
  {from:56,to:75,icon:BrainCircuit,kicker:'POWERED BY META MUSE SPARK',text:'Extracts per-serving amounts, store sections & pack sizes against a strict schema.'},
  {from:75,to:95,icon:MailCheck,kicker:'1-CLICK PARTNER APPROVAL',text:'Sent via email before anyone shops.'},
  {from:95,to:110,icon:BellRing,kicker:'ZERO BOTTLENECKS',text:"Scheduled reminders go out; silence counts as 'Yes' after the final reminder."},
  {from:110,to:125,icon:Calculator,kicker:'100% DETERMINISTIC CODE. ZERO LLM MATH.',text:'Multiplies portions, merges shared items & rounds to real store packs.'},
  {from:125,to:140,icon:CheckCircle2,kicker:'FULL TRACEABILITY',text:'Every line shows its math. Same week = same cart.'},
  {from:140,to:151,icon:ShoppingCart,kicker:'DIRECT TO INSTACART FAMILY CART',text:'Matches real store items automatically.'},
  {from:151,to:162,icon:Lock,kicker:'HUMAN-IN-THE-LOOP CHECKOUT',text:'You review and pay; the planner never places an order.'},
  {from:162,to:170,icon:Smartphone,kicker:'BUILT FOR MOBILE SAFARI',text:'Works seamlessly on your phone where dinner actually gets planned.'},
  {from:170,to:175,icon:Github,kicker:'100% OPEN SOURCE',text:'Runs in Demo Mode with Zero Keys.'},
  {from:175,to:180,icon:Sparkles,kicker:'FAMILY MEAL PLANNER',text:'Plan the meals, and the groceries take care of themselves.'},
];

function MessageOnly({id,frame,fresh=false}:{id:string;frame:number;fresh?:boolean}){
  const capture=useCapture();
  const crop=privacy.emailCrop;const scale=900/crop.height;
  const video=<OffthreadVideo muted src={staticFile(`${capture.directory}/${id}.mp4`)} style={{position:'absolute',left:-crop.x,top:-crop.y,width:1440,height:900}}/>;
  return <div style={{position:'absolute',inset:0,background:'#f4f5f2'}}>
    <div style={{position:'absolute',left:(1440-crop.width*scale)/2,top:0,width:crop.width,height:crop.height,overflow:'hidden',transform:`scale(${scale})`,transformOrigin:'top left'}}>
      {!fresh&&frame<privacy.emailReadyFrame?<Freeze frame={privacy.emailReadyFrame}>{video}</Freeze>:video}
    </div>
  </div>;
}

function Camera({id,seconds,mobile=false,alternative=false}:{id:string;seconds:number;mobile?:boolean;alternative?:boolean}){
  const frame=useCurrentFrame();const {fps}=useVideoConfig();
  const capture=useCapture();const points=capture.telemetry.filter(e=>e.scene===id);
  const parts=capture.editMap.find(e=>e.scene===id)?.parts??[];
  const mail=parts.some((part,index)=>part.view==='mail'&&frame>=part.fromMs/1000*fps-2&&frame<(parts[index+1]?.fromMs??Infinity)/1000*fps+2);
  let zoom=1,x=50,y=45,weight=0;
  for(const e of points){
    const start=e.timeMs/1000*fps-12;const time=frame-start;
    if(time<0||time>140)continue;
    const enter=spring({fps,frame:time,config:{damping:25,stiffness:90,mass:1}});
    const leave=interpolate(time,[88,134],[1,0],clamp);
    const envelope=Math.min(1,enter)*leave;
    if(envelope>weight){weight=envelope;zoom=1+(e.zoom-1)*envelope;x=e.xPercent;y=e.yPercent;
      if(id==='scene2-setup'&&e.xPercent===50&&Math.abs(e.yPercent-59)<1){x=capture.focusPoints.servings.xPercent;y=capture.focusPoints.servings.yPercent;}
    }
  }
  if(alternative)zoom=mail||id==='scene4b-gmail'?1:1+(zoom-1)*detailVisibility(frame,fps,points);
  if(mobile)zoom=1;
  const width=mobile?390:1440,height=mobile?844:900;
  const tx=Math.max(width-width*zoom,Math.min(0,width*.5-width*x/100*zoom));
  const ty=Math.max(height-height*zoom,Math.min(0,height*.45-height*y/100*zoom));
  const opacity=interpolate(frame,[0,7,seconds*fps-7,seconds*fps],[0,1,1,0],clamp);
  return <div style={{position:'absolute',inset:0,overflow:'hidden',opacity,background:'#f4f5f2'}}>
    <div style={{width,height,transformOrigin:'0 0',transform:`translate(${tx}px, ${ty}px) scale(${zoom})`}}>
      {capture.readmeImage&&id==='scene8-outro'&&frame<(parts[1]?.fromMs??5000)/1000*fps+2?<Img src={staticFile(capture.readmeImage)} style={{width,height,display:'block'}}/>:mail?<MessageOnly id={id} frame={frame} fresh/>:alternative&&capture.directory==='clips'&&id==='scene4b-gmail'&&frame<privacy.emailEndMs/1000*fps+2
        ?<MessageOnly id={id} frame={frame}/>
        :<OffthreadVideo muted src={staticFile(`${capture.directory}/${id}.mp4`)} style={{width,height,display:'block'}}/>}
    </div>
  </div>;
}

function Browser({id,seconds,profile,alternative=false}:{id:string;seconds:number;profile:string;alternative?:boolean}){
  const frame=useCurrentFrame();
  const capture=useCapture();const parts=capture.editMap.find(e=>e.scene===id)?.parts??[];
  const url=[...parts].reverse().find(p=>p.fromMs<=frame/30*1000)?.host??(profile==='reviewer'?'mail.google.com':capture.editMap.flatMap(e=>e.parts).find(p=>p.host!=='mail.google.com')?.host??'localhost');
  return <div style={{position:'absolute',left:336,top:64,width:1248,borderRadius:18,overflow:'hidden',boxShadow:'0 32px 110px #0008',border:'1px solid #ffffff24',background:'#f4f5f2'}}>
    <div style={{height:44,background:'#e7ebe4',display:'flex',alignItems:'center',gap:18,padding:'0 20px',color:'#69716a'}}>
      <div style={{display:'flex',gap:8}}>{['#ef8576','#eac475','#8fb996'].map(c=><span key={c} style={{width:11,height:11,borderRadius:12,background:c}}/>)}</div>
      <ChevronLeft size={17}/><ChevronRight size={17}/>
      <div style={{position:'absolute',left:'27%',width:'46%',height:28,borderRadius:7,background:'#f9faf7',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center',gap:7}}><Lock size={11}/>{url}</div>
      <div style={{marginLeft:'auto',fontSize:11,letterSpacing:1.3}}>FAMILY MEAL PLANNER</div>
    </div>
    <div style={{position:'relative',width:1248,height:780}}><div style={{position:'absolute',width:1440,height:900,transform:'scale(0.8666666667)',transformOrigin:'top left'}}><Camera id={id} seconds={seconds} alternative={alternative}/></div></div>
  </div>;
}

function Phone({id,seconds}:{id:string;seconds:number}){
  const capture=useCapture();
  return <>
    <div style={{position:'absolute',inset:0,opacity:.25,filter:'blur(28px)',transform:'scale(1.12)'}}><OffthreadVideo muted src={staticFile(`${capture.directory}/${id}.mp4`)} style={{width:'100%',height:'100%',objectFit:'cover'}}/></div>
    <div style={{position:'absolute',left:743,top:52,width:434,height:916,padding:17,boxSizing:'border-box',transform:'scale(.86)',transformOrigin:'top center',borderRadius:64,background:'linear-gradient(135deg,#b5b5a9,#555c54 32%,#c7c6b9 64%,#656b61)',boxShadow:'0 25px 80px #0009',border:'2px solid #d9dcce'}}>
      <div style={{position:'absolute',left:-5,top:165,width:4,height:70,background:'#899083',borderRadius:2}}/>
      <div style={{position:'absolute',right:-5,top:210,width:4,height:110,background:'#899083',borderRadius:2}}/>
      <div style={{position:'relative',width:396,height:878,boxSizing:'border-box',overflow:'hidden',borderRadius:48,background:'#f4f5f2',border:'3px solid #181f18'}}>
        <div style={{position:'absolute',left:0,top:0,height:33,width:'100%',background:'#f4f5f2',zIndex:2,color:'#1c2820',fontSize:12,padding:'10px 25px'}}>9:41<span style={{float:'right'}}>5G ▰</span></div>
        <div style={{position:'absolute',left:0,top:32,width:390,height:844}}><Camera id={id} seconds={seconds} mobile/></div>
        <div style={{position:'absolute',left:137,top:8,width:120,height:25,borderRadius:20,background:'#101710',zIndex:3}}/>
        <div style={{position:'absolute',bottom:5,left:135,width:125,height:4,borderRadius:4,background:'#101710',zIndex:3}}/>
      </div>
    </div>
    <div style={{position:'absolute',left:244,top:400,width:370,color:ink}}><Smartphone size={44} color={green}/><div style={{fontSize:46,fontWeight:600,lineHeight:1.1,marginTop:20}}>Your week.<br/>In your pocket.</div><div style={{fontSize:18,color:muted,marginTop:20}}>iPhone 18 Pro presentation<br/>390 × 844 mobile viewport</div></div>
  </>;
}

function Caption({caption,alternative=false}:{caption:typeof captions[number];alternative?:boolean}){
  const frame=useCurrentFrame();const {fps}=useVideoConfig();const Icon=caption.icon;
  const progress=spring({fps,frame,config:{damping:20,stiffness:110}});
  const length=(caption.to-caption.from)*fps;
  const opacity=interpolate(frame,[0,8,length-9,length],[0,1,1,0],clamp);
  return <div style={{position:'absolute',left:170,right:170,bottom:42,opacity,transform:`translateY(${(1-progress)*42}px)`,borderRadius:22,background:'linear-gradient(120deg,#17291ff5,#203a2df2)',backdropFilter:alternative?undefined:'blur(22px)',border:'1px solid #d5e7cc40',boxShadow:'0 12px 50px #0007',padding:'25px 34px',display:'flex',alignItems:'center',gap:25}}>
    <div style={{width:68,height:68,borderRadius:19,background:'#b7e79c16',border:'1px solid #c7ecb22b',display:'flex',justifyContent:'center',alignItems:'center',flexShrink:0}}><Icon size={34} strokeWidth={1.6} color={green}/></div>
    <div><div style={{fontSize:15,fontWeight:700,letterSpacing:2.5,color:green,marginBottom:9}}>{caption.kicker}</div><div style={{fontSize:29,fontWeight:500,lineHeight:1.25,letterSpacing:-.45,color:ink,maxWidth:1300}}>{caption.text}</div></div>
  </div>;
}

type DemoProps={alternative?:boolean;musicSrc?:string;musicCredit?:string;capture?:CaptureData};
export function FamilyMealPlannerDemo({alternative=false,musicSrc='audio/ambient-bg.mp3',musicCredit='',capture={directory:'clips',telemetry,editMap,focusPoints}}:DemoProps={}){
  const frame=useCurrentFrame();const current=scenes.find(s=>frame>=s.from&&frame<s.from+s.seconds*30)??scenes[0];
  const currentPart=[...(capture.editMap.find(e=>e.scene===current.id)?.parts??[])].reverse().find(p=>p.fromMs<=(frame-current.from)/30*1000);
  const reviewer=(currentPart?.profile??current.profile)==='reviewer';
  return <CaptureContext.Provider value={capture}><AbsoluteFill style={{fontFamily:'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',background:'#14251d',color:ink}}>
    <AbsoluteFill style={{background:'radial-gradient(ellipse at 16% 10%,#a6bb7d38,transparent 50%),radial-gradient(ellipse at 90% 90%,#d6a96822,transparent 50%),linear-gradient(145deg,#203c2d,#0b1712)'}}/>
    <div style={{position:'absolute',left:70,top:27,fontSize:15,letterSpacing:3,fontWeight:600,color:green}}>FAMILY MEAL PLANNER</div>
    <div style={{position:'absolute',left:70,bottom:20,fontSize:11,letterSpacing:2.2,color:muted}}>IDEAS → MEALS → APPROVAL → GROCERIES</div>
    <div style={{position:'absolute',right:70,bottom:20,fontSize:11,color:muted,fontVariantNumeric:'tabular-nums'}}>{String(Math.floor(frame/1800)).padStart(2,'0')}:{String(Math.floor(frame/30)%60).padStart(2,'0')} / 03:00</div>
    {scenes.map(scene=><Sequence key={scene.id} from={scene.from} durationInFrames={scene.seconds*30} name={scene.title}>
      {scene.profile==='mobile'?<Phone id={scene.id} seconds={scene.seconds}/>:<Browser id={scene.id} seconds={scene.seconds} profile={scene.profile} alternative={alternative}/>}
    </Sequence>)}
    <div key={current.id} style={{position:'absolute',left:70,top:71,width:130}}><div style={{fontSize:47,fontWeight:300,color:gold,letterSpacing:-3}}>{current.step}<span style={{fontSize:18,letterSpacing:0,color:'#7f9c88'}}> /08</span></div><div style={{fontSize:16,lineHeight:1.45,color:muted,marginTop:10}}>{current.title}</div></div>
    <div style={{position:'absolute',right:66,top:20,display:'flex',alignItems:'center',gap:9,border:'1px solid #c8dfb93b',background:reviewer?'#4b3c2cf0':'#284031f0',padding:'9px 15px',borderRadius:30,fontSize:13,color:reviewer?gold:green}}>{reviewer?<MailCheck size={15}/>:<Users size={15}/>} {reviewer?'Partner Inbox (Reviewer)':'Household Planner'}<ArrowUpRight size={13}/></div>
    {captions.map(c=><Sequence key={c.from} from={c.from*30} durationInFrames={(c.to-c.from)*30} name={c.kicker}><Caption caption={c} alternative={alternative}/></Sequence>)}
    <div style={{position:'absolute',bottom:0,left:0,height:4,width:`${frame/5399*100}%`,background:`linear-gradient(90deg,${green},${gold})`}}/>
    {musicSrc?<Audio src={staticFile(musicSrc)} volume={0.35}/>:null}
    {alternative&&musicCredit&&frame>=5250?<div style={{position:'absolute',right:240,top:46,fontSize:11,color:muted}}>{musicCredit}</div>:null}
  </AbsoluteFill></CaptureContext.Provider>;
}
