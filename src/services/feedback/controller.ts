// D-051: foreground retry coordinator, independent of native storage/UI for execution tests.
export function createSyncController<T>(options: {
  run:()=>Promise<T>;
  pending:()=>boolean;
  hasCredential:()=>boolean;
  changed:()=>void;
  later:(callback:()=>void,ms:number)=>()=>void;
}) {
  let active=false, dirty=false, attempt=0;
  let current:Promise<T> | undefined;
  let cancel:(()=>void) | undefined;
  let lastError:string | undefined;
  function schedule() {if(active) void sync().catch(()=>undefined);}
  function sync():Promise<T> {
    if(current){dirty=true;return current;}
    current=(async()=>{
      try {
        let result:T;
        do {dirty=false;result=await options.run();} while(dirty && active);
        lastError=undefined;
        if(!options.pending()) attempt=0;
        return result;
      } catch(error){lastError=String(error);throw error;}
      finally {
        current=undefined;cancel?.();cancel=undefined;
        if(active && options.hasCredential() && options.pending())
          cancel=options.later(()=>{cancel=undefined;schedule();},Math.min(60000,5000*2**Math.min(attempt++,4)));
        options.changed();
      }
    })();
    return current;
  }
  return {sync,schedule,error:()=>lastError,current:()=>current,
    setActive(value:boolean){active=value;cancel?.();cancel=undefined;if(value) schedule();},
    reset(){cancel?.();cancel=undefined;attempt=0;lastError=undefined;},
  };
}
