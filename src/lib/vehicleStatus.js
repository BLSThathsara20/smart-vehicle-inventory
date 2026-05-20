/** Stored on vehicle.vehicle_status in Sanity (string). */
export const VEHICLE_STATUS_NEWLY_ARRIVED = 'Newly arrived'

export function isNewlyArrivedStatus(vehicle) {
  return vehicle?.vehicle_status === VEHICLE_STATUS_NEWLY_ARRIVED
}
