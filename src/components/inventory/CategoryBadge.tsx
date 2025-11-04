interface CategoryBadgeProps {
  icon: string
  name: string
  color: string
}

export default function CategoryBadge({ icon, name, color }: CategoryBadgeProps) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border-2 bg-white" style={{ borderColor: color }}>
      <span className="text-sm">{icon}</span>
      <span className="text-xs font-medium text-gray-700">{name}</span>
    </div>
  )
}
