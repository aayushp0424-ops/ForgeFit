'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {Camera,CameraOff,Check,X} from 'lucide-react';
import {BrowserMultiFormatReader} from '@zxing/browser';

export default function BarcodeScanner({onFound,onClose}:{onFound:(barcode:string)=>void;onClose:()=>void}) {
  const video=useRef<HTMLVideoElement>(null);
  const foundHandler=useRef(onFound);
  const [manual,setManual]=useState('');
  const [error,setError]=useState('Starting camera…');
  useEffect(()=>{foundHandler.current=onFound},[onFound]);
  useEffect(()=>{
    let cancelled=false;
    let controls: {stop:()=>void}|undefined;
    const reader=new BrowserMultiFormatReader();
    if(!navigator.mediaDevices?.getUserMedia || !window.isSecureContext){
      setError('Camera scanning requires HTTPS on your phone, or localhost on your laptop. You can enter the digits below.');
      return;
    }
    reader.decodeFromVideoDevice(undefined,video.current!, (result,_err,currentControls)=>{
      if(result && !cancelled){
        cancelled=true;
        currentControls.stop();
        foundHandler.current(result.getText().replace(/\D/g,''));
      }
    }).then(value=>{controls=value;if(cancelled) value.stop();else setError('Point your camera at a UPC/EAN barcode.');})
      .catch(()=>{if(!cancelled) setError('Could not access the camera. Check permissions, or enter barcode digits manually.');});
    return ()=>{cancelled=true;controls?.stop();};
  },[]);
  function submit(e:FormEvent){e.preventDefault();if(/^\d{8,14}$/.test(manual.trim())) foundHandler.current(manual.trim());else setError('Use 8–14 barcode digits.');}
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <div className="modal scanner-dialog" role="dialog" aria-modal="true" aria-labelledby="scan-title">
      <div className="modal-head"><div><span className="panel-overline">CAMERA OR MANUAL</span><h2 id="scan-title">Scan a food barcode</h2></div><button type="button" className="circle-button" onClick={onClose} aria-label="Close scanner"><X size={19}/></button></div>
      <div className="scan-camera"><video ref={video} muted playsInline autoPlay aria-label="Barcode scanner camera"/><div className="scan-reticle"><Camera size={32}/></div></div>
      <div className="scan-help"><CameraOff size={16}/>{error}</div>
      <form className="activity-entry" onSubmit={submit}><label className="field"><span>Enter digits under barcode</span><input type="text" inputMode="numeric" pattern="[0-9]{8,14}" maxLength={14} value={manual} placeholder="e.g. 012345678905" onChange={e=>setManual(e.target.value.replace(/\D/g,''))}/></label><button className="button button-primary" type="submit"><Check size={17}/> Find food</button></form>
      <p className="tiny-muted">The scanner reads UPC/EAN codes. A code can scan successfully without being listed in a food database.</p>
    </div>
  </div>;
}
