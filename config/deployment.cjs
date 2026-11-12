// D-051: these are deployment identities, not values to invent from the app name.
function deployment(env=process.env, required=false) {
  const projectId=env.FRIDGE_EAS_PROJECT_ID?.trim();
  const androidPackage=env.FRIDGE_ANDROID_PACKAGE?.trim();
  const apiUrl=env.EXPO_PUBLIC_API_URL?.trim();
  const problems=[];
  if(!projectId || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(projectId)) problems.push('기존 Expo projectId');
  if(!androidPackage || !/^[A-Za-z]\w*(?:\.[A-Za-z]\w*)+$/.test(androidPackage)) problems.push('기존 Android package');
  try {
    const url=new URL(apiUrl);
    if(url.protocol!=='https:' || url.username || url.password || url.search || url.hash || url.pathname!=='/' ||
      ['localhost','127.0.0.1','[::1]'].includes(url.hostname) || /(?:^|\.)example\.(com|org|net)$/.test(url.hostname)) throw Error();
  } catch {problems.push('실제 HTTPS API 주소');}
  if(required && problems.length) throw new Error(`빌드 설정 필요: ${problems.join(', ')}. docs/APP_DEPLOYMENT.md를 확인하세요.`);
  return {projectId,androidPackage,apiUrl,problems};
}
module.exports={deployment};
