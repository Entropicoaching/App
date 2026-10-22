// Own invented left-side poses. No recordings and no trained model execution.
export function fixtures() {
  return ['squat','bench','deadlift'].map((lift,c)=>({
    schema:'va-mark2-synthetic/v1',status:'synthetic_only',clip_id:'va2-'+lift,
    setup_id:'fixed-side-'+c,revision:'VA-MARK2-v1',lift,side:'left',
    image:{width:640,height:360},axis:'px_x_right_y_down',time_unit:'s',clock:'actual_timestamps',
    frames:[0,0.2,0.55,1.1].map((t_s,i)=> {
      const d = i*4;
      const truth = lift === 'bench' ? {shoulder:{x:240,y:170},hip:{x:340,y:170+d},
        knee:{x:400,y:220},ankle:{x:420,y:300},toe:{x:460,y:300},elbow:{x:220+d,y:100}} :
        {shoulder:{x:280+d,y:90},hip:{x:240+d,y:170},knee:{x:320,y:230-d},
         ankle:{x:280,y:310},toe:{x:330,y:310},elbow:{x:350,y:130+d}};
      // Deterministic known pixel noise. Its angular effect is measured, never asserted as physical evidence.
      const noise = c === 0 ? 0.2 : c === 1 ? 1:12;
      const model = Object.fromEntries(Object.entries(truth).map(([k,p])=>
        [k,{x:p.x+(k==='knee'?noise:0),y:p.y+(k==='shoulder'?noise:0)}]));
      return {frame_id:i*7,t_s,disc:{x:120,y:260},disc_px:90,truth,model};
    })
  }));
}
