export function getPreloadTimeline(imagePaths) {
  const uniquePaths = [...new Set(imagePaths)]
  return {
    type: jsPsychPreload,
    images: uniquePaths,
    show_progress_bar: true,
    message: '资源加载中，请稍候...'
  }
}
