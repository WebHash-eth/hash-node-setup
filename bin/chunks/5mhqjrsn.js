import{A as R,F as U,o as I,p as Y,r as Z,s as P}from"./pqjkx1hd.js";import{H as N}from"./aagdeg7m.js";import{$a as O,bb as W,db as Q,gb as L,jb as V}from"./nz4br084.js";function k(){return O(N.utils.randomPrivateKey())}function X(f){if(typeof f==="string"){if(!V(f,{strict:!1}))throw new Q({address:f});return{address:f,type:"json-rpc"}}if(!V(f.address,{strict:!1}))throw new Q({address:f.address});return{address:f.address,nonceManager:f.nonceManager,sign:f.sign,experimental_signAuthorization:f.experimental_signAuthorization,signMessage:f.signMessage,signTransaction:f.signTransaction,signTypedData:f.signTypedData,source:"custom",type:"local"}}var D=!1;async function F({hash:f,privateKey:B,to:q="object"}){let{r:C,s:J,recovery:G}=N.sign(f.slice(2),B.slice(2),{lowS:!0,extraEntropy:D}),w={r:W(C,{size:32}),s:W(J,{size:32}),v:G?28n:27n,yParity:G};return(()=>{if(q==="bytes"||q==="hex")return Y({...w,to:q});return w})()}async function $(f){let{contractAddress:B,chainId:q,nonce:C,privateKey:J,to:G="object"}=f,w=await F({hash:Z({contractAddress:B,chainId:q,nonce:C}),privateKey:J,to:G});if(G==="object")return{contractAddress:B,chainId:q,nonce:C,...w};return w}async function _({message:f,privateKey:B}){return await F({hash:P(f),privateKey:B,to:"hex"})}async function S(f){let{privateKey:B,transaction:q,serializer:C=R}=f,J=(()=>{if(q.type==="eip4844")return{...q,sidecars:!1};return q})(),G=await F({hash:L(C(J)),privateKey:B});return C(q,G)}async function E(f){let{privateKey:B,...q}=f;return await F({hash:U(q),privateKey:B,to:"hex"})}function b(f,B={}){let{nonceManager:q}=B,C=O(N.getPublicKey(f.slice(2),!1)),J=I(C);return{...X({address:J,nonceManager:q,async sign({hash:w}){return F({hash:w,privateKey:f,to:"hex"})},async experimental_signAuthorization(w){return $({...w,privateKey:f})},async signMessage({message:w}){return _({message:w,privateKey:f})},async signTransaction(w,{serializer:H}={}){return S({privateKey:f,transaction:w,serializer:H})},async signTypedData(w){return E({...w,privateKey:f})}}),publicKey:C,source:"privateKey"}}export{k as m,b as n};
