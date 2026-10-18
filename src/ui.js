export function escape(value='') { return String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
export async function api(path,body,method=body===undefined?'GET':'POST') {
  const response=await fetch(path,{method,credentials:'same-origin',cache:'no-store',headers:body===undefined?{}:{'Content-Type':'application/json','X-Phantom-Request':'1'},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await response.json();
  if(!response.ok)throw Object.assign(new Error(data.error||'Request failed'),{status:response.status});
  return data;
}
export const emblem='<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 5 91 29v42L50 95 9 71V29Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M29 64V32h25l16 13-16 13H41v18H29Zm12-20v3h11l4-2-4-1Z" fill="currentColor"/></svg>';
export function date(value,lang='ar') { return value?new Date(value).toLocaleDateString(lang==='ar'?'ar-EG':'en-GB',{day:'numeric',month:'short',year:'numeric'}):'—'; }
export function bytes(n) { if(n===null||n===undefined)return '—';return n<1024?`${n} B`:n<1048576?`${(n/1024).toFixed(1)} KB`:`${(n/1048576).toFixed(1)} MB`; }
export function deviceId(){let id=localStorage.getItem('phantom_browser_id');if(!id){id=crypto.randomUUID();localStorage.setItem('phantom_browser_id',id);}return id;}
export async function copy(value){await navigator.clipboard.writeText(value);}
