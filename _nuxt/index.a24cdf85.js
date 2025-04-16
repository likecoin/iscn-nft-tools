import{g as J,s as K,r as y,h as k,i as Q,o as v,c as g,f as d,t as i,j as x,a as e,k as X,v as Y,l as Z,d as $,F as j,m as q}from"./entry.ee2dc856.js";import{j as ee,g as te,a as se,k as L,b as U,l as ne,m as le,p as ae,i as oe}from"./sync.31708ed9.js";import{a as re}from"./likenft.7a91f596.js";import{s as de}from"./sync.da280c3c.js";import{u as ue}from"./wallet.e754ed07.js";import"./index.4dd71626.js";const ie=e("h1",null,"Send NFT",-1),ce={key:0,style:{color:"red"}},fe={key:1,style:{color:"green"}},ve=e("hr",null,null,-1),ge={key:2},me=e("h2",null,"1. Send NFT",-1),he=e("p",null,[e("label",null,"Enter default memo (optional)")],-1),_e=e("p",null,[e("label",null,[$("Upload NFT CSV ( "),e("a",{href:"https://github.com/likecoin/iscn-nft-tools/blob/master/send-nft/list_example.csv",target:"_blank"}," list.csv "),$(") file: ")])],-1),pe={key:0},Ie=e("thead",null,[e("tr",null,[e("td",null,"From Address"),e("td",null,"To Address"),e("td",null,"Class ID"),e("td",null,"Count")])],-1),be=e("br",null,null,-1),we=["disabled"],Se={key:3},ye=e("thead",null,[e("tr",null,[e("td",null,"From Address"),e("td",null,"To Address"),e("td",null,"Class ID"),e("td",null,"NFT ID"),e("td",null,"Memo"),e("td",null,"Status")])],-1),Te=["disabled"],De=J({__name:"index",setup(Fe){const M=ue(),{wallet:c,signer:D}=K(M),{connect:W}=M,A=y(1),T=y(""),w=y(!1),F=y(""),f=y([]),m=y([]),H=k(()=>{const a=f.value.reduce((s,o)=>{const l=`${o.from_address||""}-${o.classId}`;return s[l]||(s[l]={fromAddress:o.from_address||"",toAddress:o.to_address,classId:o.classId,count:0}),s[l].count+=1,s},{});return Object.values(a)}),O=k(()=>f.value.reduce((a,s)=>{const o=s.from_address||c.value;return a[o]||(a[o]=[]),a[o].push(s),a},{})),V=k(()=>Object.entries(O.value).reduce((a,[s,o])=>(a[s]=o.reduce((l,t)=>(l[t.classId]=(l[t.classId]||0)+1,l),{}),a),{})),C=k(()=>{const a={};return Object.entries(O.value).forEach(([s,o])=>{a[s]=o.reduce((l,t)=>(t.nftId&&(l[t.classId]=l[t.classId]||[],l[t.classId].push(t.nftId)),l),{})}),a});Q(w,a=>{a&&(T.value="")});async function z(){var a;try{if(w.value=!0,(!c.value||!D.value)&&await W(),!c.value||!D.value)return;if(!f.value.length)throw new Error("NFT data not exists");const s={};for(const[n,u]of Object.entries(V.value)){s[n]={};for(const r of Object.keys(u)){const h=V.value[n][r],{nfts:p}=await ee({classId:r,owner:n,needCount:h});if(s[n][r]=p,h>p.length)throw new Error(`NFT classId: ${r} (owner: ${n}, quantity: ${p.length}), Will send ${h} counts, NFT not enough!`);if((a=C.value[n])!=null&&a[r]){for(let I=0;I<C.value[n][r].length;I+=1){const _=C.value[n][r][I],{owner:B}=await te(r,_);if(B!==n)throw new Error(`NFT classId: ${r} nftId:${_} is not owned by ${n}!`)}s[n][r]=s[n][r].filter(I=>!C.value[n][r].includes(I.id))}}}const l=(await se(D.value)).getSigningStargateClient();if(!l)throw new Error("Signing client not exists");const t=f.value.some(n=>n.memo),{accountNumber:E,sequence:N}=await l.getSequence(c.value),b=await l.getChainId();A.value+=1;const S=[];let R=N;for(let n=0;n<f.value.length;n+=1){const u=f.value[n],r=u.from_address||c.value;let h=u.nftId;h||(h=s[r][u.classId].splice(0,1)[0].id),m.value[n].nftId=h;let p;if(r!==c.value?p={typeUrl:"/cosmos.authz.v1beta1.MsgExec",value:{grantee:c.value,msgs:[{typeUrl:"/cosmos.nft.v1beta1.MsgSend",value:L.MsgSend.encode(L.MsgSend.fromPartial({sender:r,receiver:u.to_address,classId:u.classId,id:h})).finish()}]}}:p=re(r,u.to_address,u.classId,h),t){const I=await l.sign(c.value,[p],U(1),u.memo||F.value,{accountNumber:E,sequence:R,chainId:b});m.value[n].status="signed",R+=1;try{const _=ne.TxRaw.encode(I).finish(),B=await l.broadcastTx(_,1e3,1e3);m.value[n].status=`broadcasted ${B.transactionHash}`}catch(_){if(_ instanceof le.TimeoutError)m.value[n].status=`broadcasted ${_.txId}`;else throw m.value[n].status=`error ${_.toString()}`,_}}else S.push(p)}if(S.length){const n=await l.signAndBroadcast(c.value,S,U(f.value.length),F.value);for(let u=0;u<f.value.length;u+=1)m.value[u].status=`broadcasted ${n.transactionHash}`}}catch(s){console.error(s),T.value=s.toString()}finally{w.value=!1}}function G(a){var t;if(!(a!=null&&a.target))return;const s=(t=a.target)==null?void 0:t.files;if(!s)return;const[o]=s,l=new FileReader;l.onload=E=>{var N;try{const b=(N=E.target)==null?void 0:N.result;if(typeof b!="string")return;const S=ae(b,{columns:!0});f.value=S,m.value=S}catch(b){console.error(b),T.value=b.toString()}},l.readAsText(o)}function P(){oe(de(m.value),"result.csv","text/csv;charset=utf-8;")}return(a,s)=>{var o,l;return v(),g("div",null,[ie,d(T)?(v(),g("div",ce,i(d(T)),1)):x("",!0),d(w)?(v(),g("div",fe," Loading... ")):x("",!0),e("div",null,"Steps "+i(d(A))+" / 2",1),ve,d(A)===1?(v(),g("section",ge,[me,e("div",null,[he,X(e("input",{"onUpdate:modelValue":s[0]||(s[0]=t=>Z(F)?F.value=t:null),placeholder:"default memo"},null,512),[[Y,d(F)]]),_e,(o=d(f))!=null&&o.length?(v(),g("div",pe,[e("pre",null,"Number of NFT data in CSV:"+i((l=d(f))==null?void 0:l.length),1),$(" Summary "),e("table",null,[Ie,e("tbody",null,[(v(!0),g(j,null,q(d(H),t=>(v(),g("tr",{key:t.fromAddress+"-"+t.fromAddress+"-"+t.classId},[e("td",null,i(t.fromAddress||d(c)),1),e("td",null,i(t.toAddress),1),e("td",null,i(t.classId),1),e("td",null,i(t.count),1)]))),128))])])])):x("",!0),e("input",{type:"file",onChange:G},null,32),be,e("button",{disabled:d(w),style:{"margin-top":"16px"},onClick:z}," Send ",8,we)])])):x("",!0),d(A)>1?(v(),g("section",Se,[$(" Result: "),e("table",null,[ye,e("tbody",null,[(v(!0),g(j,null,q(d(m),t=>(v(),g("tr",{key:t[0]},[e("td",null,i(t.from_address||d(c)),1),e("td",null,i(t.to_address),1),e("td",null,i(t.classId),1),e("td",null,i(t.nftId),1),e("td",null,i(t.memo),1),e("td",null,i(t.status),1)]))),128))])]),e("button",{disabled:d(w),onClick:P}," Download NFT result csv ",8,Te)])):x("",!0)])}}});export{De as default};
