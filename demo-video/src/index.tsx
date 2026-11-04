import React from 'react';
import {Composition,registerRoot} from 'remotion';
import {FamilyMealPlannerDemo} from './video';

const Root=()=> <>
  <Composition id="FamilyMealPlannerDemo" component={FamilyMealPlannerDemo} durationInFrames={5400} fps={30} width={1920} height={1080}/>
  <Composition id="FamilyMealPlannerAlternative" component={FamilyMealPlannerDemo} durationInFrames={5400} fps={30} width={1920} height={1080} defaultProps={{alternative:true,musicSrc:'',musicCredit:''}}/>
</>;
registerRoot(Root);
