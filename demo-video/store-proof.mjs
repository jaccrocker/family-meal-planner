import assert from 'node:assert/strict';

export async function storeProof(page,expectedNames){
  const rows=await page.getByRole('button',{name:'unselect item',exact:true}).evaluateAll(buttons=>buttons.map(button=>{
    let node=button,best=null;
    while(node){const links=node.querySelectorAll('a[href^="/products/"]');if(links.length>1)break;if(links.length===1)best=node;node=node.parentElement;}
    const link=best?.querySelector('a[href^="/products/"]');
    return {text:best?.innerText??'',path:link?new URL(link.href).pathname:null};
  }));
  const names=[...expectedNames].sort((a,b)=>b.length-a.length);
  const mapping=rows.map(row=>({ingredient:names.find(name=>row.text.toLowerCase().includes(name.toLowerCase())),productId:row.path?.match(/^\/products\/(\d+)/)?.[1]}));
  const missingIngredients=expectedNames.filter(name=>!mapping.some(row=>row.ingredient===name));
  assert.equal(mapping.length,expectedNames.length,'Every ingredient needs a selected product row');
  assert.equal(missingIngredients.length,0,'No ingredient may be omitted');
  assert.ok(mapping.every(row=>row.productId),'Every selection must reference a real product');
  const groups=new Map();
  for(const row of mapping){const group=groups.get(row.productId)??[];group.push(row.ingredient);groups.set(row.productId,group);}
  return {expectedLines:expectedNames.length,selectedLines:mapping.length,uniqueProducts:groups.size,missingIngredients,mergedProducts:[...groups].filter(([,ingredients])=>ingredients.length>1).map(([productId,ingredients])=>({productId,ingredients})),mapping};
}
