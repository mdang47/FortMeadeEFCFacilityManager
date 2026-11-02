/* EFC STAFF SESSION - OFFLINE GRACE (UI ONLY)
 * Lets a session that the server verified recently open staff pages while the
 * gym has no internet. This is a convenience, not a security boundary:
 * - it never creates, extends, or replaces a server token;
 * - every Sheets read/write still sends the token and the server validates it;
 * - a server rejection (success:false) always wins and clears the offline record.
 * Stores only name, id, roles and timestamps. Never stores PINs.
 */
(function(){
  const TOKEN_KEY='efc-staff-token-v1';
  const SESSION_KEY='efc-staff-session-v1';
  const OFFLINE_GRACE_MS=72*3600000;   // max time since the last successful server check
  const UNKNOWN_EXPIRY_MS=8*3600000;   // if the server expiry is unknown, assume an 8-hour session
  const TIMEOUT_MS=10000;

  function read(){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null');}catch(e){return null;}}
  function bind(token){return String(token||'').slice(-16);}
  function forget(){localStorage.removeItem(SESSION_KEY);}

  // Call after the server accepted the token (login or authValidate).
  function remember(token,staff,expiresAt){
    if(!token||!staff)return;
    const prev=read();
    const sameToken=prev&&prev.bind===bind(token);
    localStorage.setItem(SESSION_KEY,JSON.stringify({
      bind:bind(token),
      staff:{id:String(staff.id||''),name:String(staff.name||''),roles:Array.isArray(staff.roles)?staff.roles:[],forceReset:staff.forceReset===true},
      expiresAt:expiresAt||(sameToken?prev.expiresAt:null)||null,
      validatedAt:Date.now()
    }));
  }

  function offlineSession(token){
    const s=read();
    if(!s||!token||s.bind!==bind(token)||!s.staff||s.staff.forceReset)return null;
    const now=Date.now(),checked=Number(s.validatedAt)||0;
    const expiry=s.expiresAt?new Date(s.expiresAt).getTime():checked+UNKNOWN_EXPIRY_MS;
    const until=Math.min(expiry,checked+OFFLINE_GRACE_MS);
    if(!(checked>0&&checked<=now+60000&&now<until))return null;
    return {staff:s.staff,until,validatedAt:checked};
  }

  // Resolves {token,staff,offline}. Throws when signed out, rejected by the server,
  // or offline without a recent verified session on this device.
  async function validate(apiUrl){
    const token=localStorage.getItem(TOKEN_KEY)||'';
    if(!token){const e=Error('Please sign in to continue.');e.efcAuth=true;throw e;}
    let data;
    try{
      if(navigator.onLine===false)throw Error('Device is offline.');
      const ctl=window.AbortController?new AbortController():null;
      const timer=ctl?setTimeout(()=>ctl.abort(),TIMEOUT_MS):0;
      try{
        const response=await fetch(apiUrl,{method:'POST',body:JSON.stringify({action:'authValidate',token}),signal:ctl?ctl.signal:undefined});
        if(!response.ok)throw Error('HTTP '+response.status);
        data=await response.json();
      }finally{clearTimeout(timer);}
    }catch(networkError){
      // Network failure, timeout, or a non-JSON error page: the server did NOT reject us.
      const off=offlineSession(token);
      if(off)return {token,staff:off.staff,offline:true,until:off.until,validatedAt:off.validatedAt};
      const e=Error('No internet connection, and this device has no recently verified staff session. Connect to the internet and sign in.');
      e.efcOffline=true;throw e;
    }
    if(!data||data.success!==true||!data.staff){
      forget();
      const e=Error((data&&data.message)||'Session expired. Please sign in again.');e.efcAuth=true;throw e;
    }
    remember(token,data.staff,data.expiresAt);
    return {token,staff:data.staff,offline:false};
  }

  let lockTimer=0;
  // Shows or removes the offline banner. While offline, reloads the page when the
  // grace window ends so the normal sign-in gate comes back.
  function banner(result){
    let el=document.getElementById('efcOfflineBanner');
    clearTimeout(lockTimer);
    if(!result||!result.offline){if(el)el.remove();return;}
    if(!el){
      el=document.createElement('div');el.id='efcOfflineBanner';el.setAttribute('role','status');
      el.style.cssText='position:sticky;top:0;z-index:100001;background:#fff4d6;color:#5a3d00;border-bottom:2px solid #e0b040;padding:10px 14px;font:600 14px system-ui,-apple-system,sans-serif;text-align:center';
      document.body.prepend(el);
    }
    el.textContent='Offline mode — '+result.staff.name+' (last verified '+new Date(result.validatedAt).toLocaleString()+'). Showing data saved on this device. Server data and saving to Google Sheets will resume when internet returns. Offline access ends '+new Date(result.until).toLocaleString()+'.';
    lockTimer=setTimeout(()=>location.reload(),Math.max(1000,Math.min(result.until-Date.now(),2147000000)));
  }

  window.EFCStaffSession={validate,remember,forget,offlineSession,banner,TOKEN_KEY};
})();
