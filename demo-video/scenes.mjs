const definitions = [
  {id:'scene1-landing', seconds:20, step:'01', title:'A better Sunday', profile:'planner'},
  {id:'scene2-setup', seconds:20, step:'02', title:'Made for your household', profile:'planner'},
  {id:'scene3-meals', seconds:35, step:'03', title:'From ideas to a real week', profile:'planner'},
  {id:'scene4a-send', seconds:12, step:'04', title:'Keep everyone in the loop', profile:'planner'},
  {id:'scene4b-gmail', seconds:13, step:'04', title:'One click from the inbox', profile:'reviewer'},
  {id:'scene4c-approved', seconds:10, step:'04', title:'Everyone is on board', profile:'planner'},
  {id:'scene5-review', seconds:30, step:'05', title:'Trust every quantity', profile:'planner'},
  {id:'scene6-shop', seconds:22, step:'06', title:'The list goes shopping', profile:'planner'},
  {id:'scene7-mobile', seconds:8, step:'07', title:'Dinner plans travel with you', profile:'mobile'},
  {id:'scene8-outro', seconds:10, step:'08', title:'Built in the open', profile:'planner'},
];
let offset=0;
export const scenes=definitions.map(scene=>{const from=offset;offset+=scene.seconds*30;return {...scene,from};});
if(offset!==5400) throw new Error('Scene timeline must total 5,400 frames');
