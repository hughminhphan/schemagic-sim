import { canonicalizeCircuit, migrateCircuit, type CircuitDocument } from "@opencircuit/circuit-schema";
export interface Workspace { id:string; name:string; updatedAt:number; document:CircuitDocument }
const DB="schemagic-simulator",STORE="workspaces",ACTIVE="schemagic.active-workspace";
function database():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const request=indexedDB.open(DB,1);request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:"id"});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
function request<T>(operation:(store:IDBObjectStore)=>IDBRequest<T>,mode:IDBTransactionMode="readonly"):Promise<T>{return database().then(db=>new Promise((resolve,reject)=>{const tx=db.transaction(STORE,mode),req=operation(tx.objectStore(STORE));req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);tx.oncomplete=()=>db.close();}));}
export async function listWorkspaces():Promise<Workspace[]>{const rows=await request<Workspace[]>(store=>store.getAll());return rows.sort((a,b)=>b.updatedAt-a.updatedAt).map(row=>({...row,document:migrateCircuit(row.document)}));}
export async function saveWorkspace(workspace:Workspace):Promise<void>{await request(store=>store.put({...workspace,document:JSON.parse(canonicalizeCircuit(workspace.document))}),"readwrite");localStorage.setItem(ACTIVE,workspace.id);}
export async function deleteWorkspace(id:string):Promise<void>{await request(store=>store.delete(id),"readwrite");if(localStorage.getItem(ACTIVE)===id)localStorage.removeItem(ACTIVE);}
export async function loadWorkspace(id:string):Promise<Workspace|undefined>{const row=await request<Workspace|undefined>(store=>store.get(id));return row?{...row,document:migrateCircuit(row.document)}:undefined;}
export const activeWorkspaceId=()=>localStorage.getItem(ACTIVE);
export const makeWorkspace=(document:CircuitDocument,name=document.meta.title):Workspace=>({id:crypto.randomUUID(),name,updatedAt:Date.now(),document:structuredClone(document)});
