const {deployment}=require('./config/deployment.cjs');
const project=require('./config/expo-project.json');

module.exports=({config})=>{
  const required=process.env.EAS_BUILD==='true' || !!process.env.EAS_BUILD_PROFILE;
  const settings=deployment(process.env,required);
  return {...config,name:project.name,slug:project.slug,scheme:project.scheme,
    ...(settings.owner ? {owner:settings.owner} : {}),
    android:{...config.android,...(settings.androidPackage ? {package:settings.androidPackage} : {})},
    extra:{...config.extra,...(settings.projectId ? {eas:{projectId:settings.projectId}} : {})}};
};
