const {deployment}=require('./config/deployment.cjs');

module.exports=({config})=>{
  const required=process.env.EAS_BUILD==='true' || !!process.env.EAS_BUILD_PROFILE;
  const settings=deployment(process.env,required);
  return {...config,owner:'hj1640',
    android:{...config.android,...(settings.androidPackage ? {package:settings.androidPackage} : {})},
    extra:{...config.extra,...(settings.projectId ? {eas:{projectId:settings.projectId}} : {})}};
};
