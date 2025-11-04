'use client'

export default function LoadingBar() {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-transparent">
      <div className="h-full bg-black animate-loading-bar origin-left"></div>
    </div>
  )
}
