/*
 * ÂM THANH SA BÀN BẠCH ĐẰNG 938 — không cần CDN.
 * Giọng nam: ưu tiên NamMinh/giọng Nam tiếng Việt sẵn có trong trình duyệt.
 * Dự phòng: chín file MP3 giọng nam tổng hợp được đóng gói trong /audio.
 * Âm thanh chiến trận được tổng hợp bằng Web Audio, không dùng file có bản quyền.
 */
(() => {
 'use strict';
 const SCRIPT = [
  {t:0, file:'00-tran-dia.mp3', text:'Năm 938, Ngô Quyền đặt bãi cọc nhọn bịt sắt, bí mật mai phục quân ở hai bờ sông Bạch Đằng.'},
  {t:7, file:'01-trieu-len.mp3', text:'Thủy triều dâng cao, che kín bãi cọc. Từ trong sông, thuyền nhẹ quân ta tiến ra khiêu chiến.'},
  {t:15, file:'02-gia-rut.mp3', text:'Sau khi khiêu chiến, quân ta bất ngờ quay đầu giả rút. Địch lập tức đuổi theo.'},
  {t:22, file:'03-nhu-dich.mp3', text:'Hăm hở truy đuổi, thuyền Nam Hán vượt qua bãi cọc ngập nước mà không hề hay biết.'},
  {t:27, file:'04-nuoc-rut.mp3', text:'Đúng lúc ấy, thủy triều bắt đầu rút. Bãi cọc dần lộ ra, còn thuyền ta luồn qua lối thoát đã chuẩn bị.'},
  {t:39, file:'05-phan-cong.mp3', text:'Hiệu lệnh phản công! Quân ta từ hai bên bờ đồng loạt đánh mạnh vào đội hình địch.'},
  {t:44, file:'06-mac-coc.mp3', text:'Nước rút nhanh! Những chiến thuyền lớn va vào cọc nhọn, thủng đáy và mắc kẹt.'},
  {t:49, file:'07-thuyen-chim.mp3', text:'Giữa vòng vây, nhiều thuyền địch bị hư hại, chìm dần; quân lính hoảng loạn, rơi xuống sông.'},
  {t:57, file:'08-chien-thang.mp3', text:'Bạch Đằng năm 938! Chiến thắng vang dội, mở ra thời kì độc lập, tự chủ của dân tộc.'}
 ];
 const $ = id => document.getElementById(id);
 const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
 const AC = window.AudioContext || window.webkitAudioContext;
 let active=false, voiceWanted=true, fxWanted=true, voiceMode='auto', volume=.75, voiceRate=1.0, fxLevel=.30;
 let audioCtx=null, fxBus=null, ambience={}, sounds={}, narration=null, lastVoiceStage=-1;
 let lastState={time:0,paused:true,speed:1,finished:false};
 let lastFXTime=null, lastPaddle=-99,lastBattle=-99,lastFire=-99;
 let voiceTech='offline', selectedVoice=null, pausedVoice=false, manualPreview=false, status='';
 let vietnameseVoices=[], narrationAudible=false, voiceGeneration=0;
 let stateUpdateClock=0;
 const media=new Audio();media.preload='auto';media.setAttribute('playsinline','');
 media.addEventListener('error',()=>{if(active&&voiceWanted)report('Không đọc được MP3: hãy giải nén nguyên thư mục audio và mở lại index.html.');});
 media.addEventListener('play',()=>setNarrationAudible(true));
 media.addEventListener('pause',()=>setNarrationAudible(false));
 media.addEventListener('ended',()=>setNarrationAudible(false));
 const voiceApi=('speechSynthesis' in window)?window.speechSynthesis:null;
 const suppressUnhandled=p=>{if(p&&typeof p.catch==='function')p.catch(()=>{});};
 const idxAt=t=>{let result=0;for(let i=0;i<SCRIPT.length;i++)if(t>=SCRIPT[i].t)result=i;return result;};
 function report(message){status=message;const el=$('soundStatus');if(el)el.textContent=message;}
 function voiceIsMale(v){return /namminh|nam minh|\bmale\b|giọng nam|\bman\b/i.test(v.name);}
 function refreshVoices(){
  if(!voiceApi){selectVoiceTech();return;}
  const list=voiceApi.getVoices();
  vietnameseVoices=list.filter(v=>/^vi($|[-_])/i.test(v.lang));
  const select=$('soundVoiceMode');if(!select)return;
  const before=select.value;
  Array.from(select.querySelectorAll('option[data-system-voice]')).forEach(o=>o.remove());
  vietnameseVoices.forEach((v,i)=>{
   const opt=document.createElement('option');opt.value='sys:'+i;opt.dataset.systemVoice='1';
   opt.textContent=(voiceIsMale(v)?'Nam · ':'Việt · ')+v.name+(v.localService?' · trên máy':' · có thể cần Internet');
   select.appendChild(opt);
  });
  if(Array.from(select.options).some(o=>o.value===before))select.value=before;
  selectVoiceTech();
 }
 function chooseNaturalVoice(){
  if(voiceMode.startsWith('sys:'))return vietnameseVoices[Number(voiceMode.slice(4))]||null;
  if(voiceMode==='offline')return null;
  // Ưu tiên giọng nam tiếng Việt cài trên máy. Không có thì dùng giọng Việt khác
  // để phát âm dấu rõ hơn, thay vì áp giọng tiếng Anh lên văn bản tiếng Việt.
  return vietnameseVoices.find(v=>voiceIsMale(v)&&v.localService) ||
         vietnameseVoices.find(v=>voiceIsMale(v)) ||
         vietnameseVoices.find(v=>v.localService) ||vietnameseVoices[0]||null;
 }
 function selectVoiceTech(){
  selectedVoice=chooseNaturalVoice();
  voiceTech=selectedVoice?'natural':'offline';
  report(selectedVoice?'Đang dùng '+selectedVoice.name+'. Giọng hệ thống phụ thuộc phiên bản Windows và trình duyệt.':'Giọng nam MP3 offline đã được làm chậm, lọc tạp âm và chuẩn hóa âm lượng. Vẫn có chất máy đọc; bạn có thể chọn giọng Việt khác nếu thiết bị cung cấp.');
 }
 if(voiceApi){voiceApi.addEventListener?.('voiceschanged',refreshVoices);}
 function setNarrationAudible(on){narrationAudible=Boolean(on);updateFxMix();}
 function updateFxMix(){
  if(!audioCtx||!fxBus)return;
  // Hạ hiệu ứng ~75% lúc đang có tiếng nói, tránh tên bắn/sóng lấn giọng.
  const desired=volume * fxLevel * (voiceWanted&&narrationAudible ? 0.22 : 0.78);
  fxBus.gain.setTargetAtTime(desired,audioCtx.currentTime,.09);
 }
 function stopNarration(){
  voiceGeneration++;
  media.pause();try{media.currentTime=0;}catch(e){}media.onended=null;
  if(voiceApi){try{voiceApi.cancel();}catch(e){}}
  narration=null;pausedVoice=false;setNarrationAudible(false);
 }
 function playbackVoiceSpeed(){
  // Tách tốc độ video khỏi tốc độ giọng: xem phim 2× cũng không làm méo lời dẫn.
  return clamp(voiceRate,.8,1.15);
 }
 function startNarration(index){
  if(!active||!voiceWanted)return;
  stopNarration();lastVoiceStage=index;
  const seg=SCRIPT[index],gen=voiceGeneration;
  if(voiceTech==='natural'&&selectedVoice&&window.SpeechSynthesisUtterance){
   try{
    const u=new SpeechSynthesisUtterance(seg.text);u.lang='vi-VN';u.voice=selectedVoice;
    u.rate=playbackVoiceSpeed();u.pitch=voiceIsMale(selectedVoice) ? 0.97 : 1.0;u.volume=clamp(volume,0,1);
    u.onstart=()=>{if(gen===voiceGeneration)setNarrationAudible(true)};
    u.onend=()=>{if(gen===voiceGeneration)setNarrationAudible(false)};
    u.onerror=e=>{
     if(gen!==voiceGeneration||!active||!voiceWanted)return;
     setNarrationAudible(false);
     if(e.error!=='canceled'&&e.error!=='interrupted'){
      voiceTech='offline';report('Giọng hệ thống chưa phát được. Đã chuyển sang MP3 offline.');playOffline(index);
     }
    };
    narration=u;voiceApi.speak(u);return;
   }catch(e){voiceTech='offline';}
  }
  playOffline(index);
 }
 function playOffline(index){
  narration='offline';
  media.src='audio/'+SCRIPT[index].file;
  media.volume=clamp(volume,0,1);
  media.playbackRate=playbackVoiceSpeed();
  const promise=media.play();
  if(promise && typeof promise.catch==='function')promise.catch(e=>report('Không thể phát MP3: '+(e?.name||'kiểm tra thư mục audio')+'. Nhấn nút nghe thử để bật âm thanh.'));
 }
 function voicePause(){
  if(pausedVoice)return;
  if(voiceTech==='natural'&&voiceApi){try{voiceApi.pause();}catch(e){}}
  else media.pause();pausedVoice=true;setNarrationAudible(false);
 }
 function voiceResume(){
  if(!pausedVoice)return;
  if(voiceTech==='natural'&&voiceApi){try{voiceApi.resume();}catch(e){}}
  else if(narration==='offline')suppressUnhandled(media.play());
  pausedVoice=false;
 }
 // Deterministic procedural buffers: wood/oar, soft waves, arrows, metal, hull impact and fire.
 let seed=938;
 function random(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
 function makeBuffer(kind,dur){
  if(!audioCtx)return null;
  const rate=audioCtx.sampleRate,len=Math.floor(dur*rate),buffer=audioCtx.createBuffer(1,len,rate),out=buffer.getChannelData(0);
  let low=0,mid=0;
  for(let i=0;i<len;i++){
   const t=i/rate,white=random()*2-1,env=Math.pow(Math.max(0,1-t/dur),kind==='crash'?.7:1.45);
   low+=(white-low)*.017;mid+=(white-mid)*.15;
   let x=0;
   switch(kind){
    case 'river':x=(low*.38+mid*.10)*(.72+.2*Math.sin(t*2.7))+.008*Math.sin(2*Math.PI*92*t);break;
    case 'rowing':x=env*(low*.47+mid*.24)+.025*Math.sin(2*Math.PI*(170-80*t)*t)*env;break;
    case 'arrow':x=env*(mid*.30+white*.12)+.16*Math.sin(2*Math.PI*(780-540*t/dur)*t)*env;break;
    case 'metal':x=env*(.3*Math.sin(2*Math.PI*730*t)+.22*Math.sin(2*Math.PI*1235*t)+.15*Math.sin(2*Math.PI*1960*t)+mid*.2);break;
    case 'crash':x=env*(.28*Math.sin(2*Math.PI*84*t)+.15*Math.sin(2*Math.PI*156*t)+mid*.6+white*.08);break;
    case 'splash':x=env*(low*.34+mid*.28+white*.025)+.018*Math.sin(2*Math.PI*(160-80*t/dur)*t)*env;break;
    case 'fire':{
      const fizz=white*.027+mid*.07;
      const burst=(Math.sin(t*29.1)**32+Math.sin(t*17.4+2)**36)*.055;
      x=fizz+burst*white*.8;break;
    }
    default:x=0;
   }
   const fade=Math.min(1,t*30,Math.max(0,(dur-t)*32));out[i]=clamp(x*fade,-.98,.98);
  }
  return buffer;
 }
 function initEngine(){
  if(!AC)return;
  if(audioCtx){suppressUnhandled(audioCtx.resume());return;}
  try{
   audioCtx=new AC();fxBus=audioCtx.createGain();fxBus.gain.value=volume*fxLevel*.78;fxBus.connect(audioCtx.destination);
   const spec={river:4,rowing:.65,arrow:.6,metal:.85,crash:1.5,splash:.85,fire:3};
   for(const [name,dur] of Object.entries(spec))sounds[name]=makeBuffer(name,dur);
   suppressUnhandled(audioCtx.resume());updateFxMix();
  }catch(e){audioCtx=null;report('Thiết bị chưa hỗ trợ Web Audio; vẫn có thể dùng thuyết minh bằng MP3.');}
 }
 function playFX(name,level=.5){
  if(!active||!fxWanted||!audioCtx||!fxBus||!sounds[name])return null;
  const src=audioCtx.createBufferSource(),gain=audioCtx.createGain();src.buffer=sounds[name];
  gain.gain.value=level;src.connect(gain).connect(fxBus);src.start();return src;
 }
 function startLoop(name,level){
  if(ambience[name]||!audioCtx||!sounds[name])return;
  const src=audioCtx.createBufferSource(),gain=audioCtx.createGain();src.buffer=sounds[name];src.loop=true;
  gain.gain.value=0;src.connect(gain).connect(fxBus);src.start();
  gain.gain.setTargetAtTime(level,audioCtx.currentTime,.2);ambience[name]={src,gain};
 }
 function stopLoop(name){
  const obj=ambience[name];if(!obj)return;
  obj.gain.gain.setTargetAtTime(0,audioCtx.currentTime,.11);
  try{obj.src.stop(audioCtx.currentTime+.7);}catch(e){}
  delete ambience[name];
 }
 function stopFX(){for(const name of Object.keys(ambience))stopLoop(name);lastFXTime=null;}
 function updateFX(s){
  if(!active||!fxWanted||!audioCtx){stopFX();return;}
  // Vùng kết thúc vẫn có sóng và lửa/khói khi hoạt cảnh đã dừng ở 01:00.
  const activeSound=(!s.paused || s.time>=59.99);
  if(!activeSound){stopFX();return;}
  startLoop('river',.28);
  if(s.time>=49)startLoop('fire',.40);else stopLoop('fire');
  if(s.time<59.99){
   const jump=lastFXTime===null||s.time<lastFXTime||s.time-lastFXTime>1.0;
   if(!jump){
    const cues=[{t:7,name:'rowing',v:.45},{t:15,name:'rowing',v:.60},{t:27,name:'rowing',v:.5},
      {t:39,name:'arrow',v:.40},{t:41,name:'metal',v:.32},{t:44,name:'crash',v:.9},
      {t:45.5,name:'metal',v:.8},{t:48,name:'crash',v:.65},{t:49.6,name:'splash',v:.95},
      {t:51,name:'splash',v:.7},{t:53,name:'metal',v:.35}];
    for(const cue of cues)if(lastFXTime<cue.t&&s.time>=cue.t)playFX(cue.name,cue.v);
   }
   if(s.time>=7&&s.time<35 && s.time-lastPaddle>2.25){playFX('rowing',.32);lastPaddle=s.time;}
   if(s.time>=39&&s.time<53 && s.time-lastBattle>3.0){playFX('arrow',.28);lastBattle=s.time;}
  }else if(s.time>=60 && lastFXTime!==null && lastFXTime<59.99){playFX('splash',.22);}
  lastFXTime=s.time;
 }
 function setCaption(time){
  const idx=idxAt(time),num=$('soundCaption').querySelector('.caption-number');
  if(num)num.textContent='LỜI DẪN · '+String(Math.floor(time/60)).padStart(2,'0')+':'+String(Math.floor(time%60)).padStart(2,'0');
  $('soundCaptionText').textContent=SCRIPT[idx].text;
 }
 function onFrame(state){
  lastState={...state};
  const idx=idxAt(state.time),isPlaying=!state.paused;
  if(state.time===0&&lastVoiceStage>=0&&lastVoiceStage!==0&&!isPlaying){stopNarration();lastVoiceStage=-1;}
  if(active&&voiceWanted){
   if(isPlaying){
    if(idx!==lastVoiceStage)startNarration(idx);
    else voiceResume();
   } else if(state.time>=59.99 || manualPreview){
    // Để người dùng nghe hết lời dẫn khi bật loa lúc đang dừng,
    // và không cắt câu kết luận ở giây 60.
   } else voicePause();
  }
  updateFX(state);
  if(performance.now()-stateUpdateClock>140){setCaption(state.time);stateUpdateClock=performance.now();}
 }
 function onSeek(state){
  lastState={...lastState,...state};manualPreview=false;stopNarration();lastVoiceStage=-1;
  stopFX();lastPaddle=-99;lastBattle=-99;
  setCaption(state.time);
  if(state.paused!==true && active && voiceWanted)startNarration(idxAt(state.time));
 }
 function onTransport(state){
  lastState={...lastState,...state};manualPreview=false;
  if(!active||!voiceWanted)return;
  if(!state.paused){
   if(lastVoiceStage!==idxAt(state.time))startNarration(idxAt(state.time));else voiceResume();
  }else if(state.time<59.99)voicePause();
 }
 function onSpeed(speed){lastState.speed=speed;/* tốc độ giọng được giữ độc lập để dễ nghe */}
 function toggleSound(){
  active=!active;
  const button=$('btnAudio');button.classList.toggle('is-on',active);
  button.setAttribute('aria-pressed',String(active));
  button.setAttribute('aria-label',active?'Tắt thuyết minh và hiệu ứng':'Bật thuyết minh và hiệu ứng');
  button.innerHTML=active?'🔊 <span>Tắt âm thanh</span>':'🔇 <span>Bật âm thanh</span>';
  if(active){manualPreview=lastState.paused;refreshVoices();initEngine();if(voiceWanted)startNarration(idxAt(lastState.time));updateFX(lastState);}
  else{manualPreview=false;stopNarration();stopFX();lastVoiceStage=-1;report('Đã tắt toàn bộ âm thanh. Chạm vào loa để bật lại.');}
 }
 function install(){
  $('btnAudio').addEventListener('click',toggleSound);
  $('soundVoice').addEventListener('change',e=>{
   voiceWanted=e.target.checked;stopNarration();lastVoiceStage=-1;updateFxMix();
   if(active&&voiceWanted)startNarration(idxAt(lastState.time));
  });
  $('soundEffects').addEventListener('change',e=>{fxWanted=e.target.checked;if(!fxWanted)stopFX();else updateFX(lastState);});
  $('soundFxLevel').addEventListener('input',e=>{fxLevel=Number(e.target.value)/100;$('soundFxLevelLabel').textContent=Math.round(fxLevel*100)+'%';updateFxMix();});
  $('soundVoiceRate').addEventListener('input',e=>{voiceRate=Number(e.target.value)/100;$('soundVoiceRateLabel').textContent=voiceRate.toFixed(2).replace('.',',')+'×';if(narration==='offline')media.playbackRate=playbackVoiceSpeed();});
  $('btnVoiceSample').addEventListener('click',()=>{if(!active){active=true;$('btnAudio').classList.add('is-on');$('btnAudio').setAttribute('aria-pressed','true');$('btnAudio').setAttribute('aria-label','Tắt âm thanh');$('btnAudio').innerHTML='🔊 <span>Tắt âm thanh</span>';} manualPreview=true;initEngine();selectVoiceTech();voiceWanted=true;$('soundVoice').checked=true;startNarration(idxAt(lastState.time));});
  $('soundVoiceMode').addEventListener('change',e=>{
   voiceMode=e.target.value;selectVoiceTech();stopNarration();lastVoiceStage=-1;
   if(active&&voiceWanted)startNarration(idxAt(lastState.time));
  });
  $('soundVolume').addEventListener('input',e=>{
   volume=Number(e.target.value)/100;$('soundVolumeLabel').textContent=Math.round(volume*100)+'%';
   media.volume=volume;updateFxMix();
  });
  document.addEventListener('pointerdown',e=>{
   const panel=$('soundSettings');if(panel?.open&&!panel.contains(e.target))panel.open=false;
  },{passive:true});
  window.addEventListener('pagehide',()=>{stopNarration();stopFX();});
  setCaption(0);refreshVoices();
 }
 window.BachAudio={onFrame,onSeek,onTransport,onSpeed};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
