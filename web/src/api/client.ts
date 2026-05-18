const base = '/api';
export const api = { get: (p:string)=>fetch(`${base}${p}`).then(r=>r.json()), post:(p:string,b:any)=>fetch(`${base}${p}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(r=>r.json())};
