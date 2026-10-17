import {rentStatus,applyDueRent} from '@/lib/rent';
const toolList=[
 {name:'get_ledger_summary',description:'Read the shared d6 ledger balances, monthly rent rule and due months. Does not modify data.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false}},
 {name:'apply_due_rent',description:'Apply all due monthly $2,125 rent records to d6 using the stored rule and New York date. Starts November 2026. Safe to retry: one record per month. Does nothing if paused or nothing is due. Never creates future rent.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true}}
];
export async function POST(req:Request){
 let message:any;try{message=await req.json();}catch{return Response.json({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}},{status:400});}
 const {id,method,params}=message;const result=(r:unknown)=>Response.json({jsonrpc:'2.0',id:id??null,result:r});
 if(method==='server/discover')return result({supportedVersions:['2026-07-28'],capabilities:{tools:{}}});
 // Compatibility for clients still negotiating the older initialize handshake.
 if(method==='initialize')return result({protocolVersion:'2025-06-18',capabilities:{tools:{}},serverInfo:{name:'Split shared ledger',version:'1.0.0'}});
 if(method==='notifications/initialized')return new Response(null,{status:202});
 if(method==='ping')return result({});
 if(method==='tools/list')return result({tools:toolList});
 if(method==='tools/call'){try{
  if(params?.arguments&&Object.keys(params.arguments).length)throw new Error('此工具不接受参数，所有规则从共享账本读取。');
  let data;if(params?.name==='get_ledger_summary')data=await rentStatus();else if(params?.name==='apply_due_rent')data=await applyDueRent();else throw new Error('Unknown tool');
  return result({content:[{type:'text',text:JSON.stringify(data)}],isError:false});
 }catch(e){return result({content:[{type:'text',text:e instanceof Error?e.message:'Unable to update ledger'}],isError:true});}}
 return Response.json({jsonrpc:'2.0',id:id??null,error:{code:-32601,message:'Method not found'}});
}
