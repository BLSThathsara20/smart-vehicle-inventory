import { useNavigate } from 'react-router-dom'
import { VehicleForm } from '../components/VehicleForm'
import { Plus } from 'lucide-react'

export function AddVehicle() {
  const navigate = useNavigate()

  return (
    <div>
      <h1 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <Plus className="w-6 h-6 text-orange-500" />
        Add Vehicle
      </h1>
      <VehicleForm onSuccess={() => navigate('/app/inventory')} />
    </div>
  )
}
