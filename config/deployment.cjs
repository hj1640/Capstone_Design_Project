// D-052: new-project identity comes from Expo, never from the old build URL.
const project=require('./expo-project.json');
function deployment(env=process.env, required=false) {
  const owner=env.FRIDGE_EXPO_OWNER?.trim() || project.owner;
  const projectId=env.FRIDGE_EAS_PROJECT_ID?.trim() || project.projectId;
  const androidPackage=env.FRIDGE_ANDROID_PACKAGE?.trim() || project.androidPackage;
  const apiUrl=env.EXPO_PUBLIC_API_URL?.trim();
  const localPreview=env.EAS_BUILD_PROFILE==='preview-local';
  const problems=[];
  if(!owner || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(owner)) problems.push('Expo 소유 계정');
  if(!projectId || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(projectId)) problems.push('Expo projectId');
  if(!androidPackage || !/^[A-Za-z]\w*(?:\.[A-Za-z]\w*)+$/.test(androidPackage)) problems.push('Android package');
  try {
    const url=new URL(apiUrl);
    if(url.protocol!=='https:' || url.username || url.password || url.search || url.hash || url.pathname!=='/' ||
      ['localhost','127.0.0.1','[::1]'].includes(url.hostname) || /(?:^|\.)example\.(com|org|net)$/.test(url.hostname)) throw Error();
  } catch {if(apiUrl || !localPreview) problems.push('실제 HTTPS API 주소');}
  if(required && problems.length) throw new Error(`빌드 설정 필요: ${problems.join(', ')}. docs/NEW_EXPO_PROJECT.md를 확인하세요.`);
  return {owner,projectId,androidPackage,apiUrl,localPreview,problems};
}
module.exports={deployment};
