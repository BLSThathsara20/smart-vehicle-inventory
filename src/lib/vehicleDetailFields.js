import { formatReservationConditionsList } from './reservationConditions'

/**
 * All vehicle detail fields for the detail view.
 * Each shows label and formats value. Empty values display as "Not added".
 */
export const DETAIL_SECTIONS = [
  {
    title: 'Core identification',
    fields: [
      { key: 'stock_id', label: 'Stock ID', format: (v) => v || 'Not added' },
      { key: 'plate_no', label: 'Plate no', format: (v) => v || 'Not added' },
      { key: 'vin', label: 'VIN', format: (v) => v || 'Not added' },
      { key: 'location', label: 'Location', format: (v) => v || 'Not added' },
    ],
  },
  {
    title: 'Technical',
    fields: [
      { key: 'brand', label: 'Brand', format: (v) => v || 'Not added' },
      { key: 'model', label: 'Model', format: (v) => v || 'Not added' },
      { key: 'body', label: 'Body type', format: (v) => v || 'Not added' },
      { key: 'color', label: 'Color', format: (v) => v || 'Not added' },
      { key: 'mileage', label: 'Mileage', format: (v) => (v != null ? `${Number(v).toLocaleString()} miles` : 'Not added') },
      { key: 'cc', label: 'Engine (cc)', format: (v) => (v != null ? `${v} cc` : 'Not added') },
      { key: 'model_year', label: 'Model year', format: (v) => v || 'Not added' },
      { key: 'fuel_type', label: 'Fuel type', format: (v) => v || 'Not added' },
      { key: 'gear', label: 'Gear', format: (v) => v || 'Not added' },
    ],
  },
  {
    title: 'Sale & pricing',
    fields: [
      { key: 'selling_price', label: 'Selling price', format: (v) => (v != null && v !== '' ? `£${Number(v).toLocaleString()}` : 'Not added') },
      { key: 'wholesale_retail', label: 'Wholesale / retail', format: (v) => v || 'Not added' },
      { key: 'warranty', label: 'Warranty', format: (v) => v || 'Not added' },
    ],
  },
  {
    title: 'Reservation (when reserved)',
    fields: [
      { key: 'customer_name', label: 'Customer name', format: (v) => v || 'Not added' },
      { key: 'customer_email', label: 'Customer email', format: (v) => v || 'Not added' },
      { key: 'customer_phone', label: 'Customer phone', format: (v) => v || 'Not added' },
      { key: 'deposit_amount', label: 'Deposit amount', format: (v) => (v != null ? `£${Number(v).toLocaleString()}` : 'Not added') },
      { key: 'deposit_agreement_url', label: 'Deposit agreement', format: (v) => v || 'Not added', isUrl: true },
      { key: 'carplay_included', label: 'CarPlay included', format: (v) => (v === true ? 'Yes' : v === false ? 'No' : 'Not added') },
      { key: 'warranty', label: 'Warranty period', format: (v) => v || 'Not added' },
      { key: 'buyers_name', label: "Buyer's name", format: (v) => v || 'Not added' },
      { key: 'reserved_date', label: 'Reserved date', format: (v) => (v ? new Date(v).toLocaleDateString() : 'Not added') },
      {
        key: 'reservation_conditions',
        label: 'Reservation conditions',
        format: (v) => formatReservationConditionsList(v),
        colSpan: 2,
      },
      { key: 'planned_collection_date', label: 'Planned collection', format: (v) => (v ? new Date(v).toLocaleDateString() : 'Not added') },
      { key: 'id_type', label: 'ID type', format: (v) => v || 'Not added' },
    ],
  },
  {
    title: 'Documentation',
    fields: [
      { key: 'doc_status', label: 'Doc status', format: (v) => v || 'Not added' },
      { key: 'shipment_no', label: 'Shipment no', format: (v) => v || 'Not added' },
      { key: 'shipment_arrived_date', label: 'Shipment arrived', format: (v) => (v ? new Date(v).toLocaleDateString() : 'Not added') },
      { key: 'key_no', label: 'Key no', format: (v) => v || 'Not added' },
      { key: 'v5c', label: 'V5C', format: (v) => v || 'Not added' },
      { key: 'v5c_send_date', label: 'V5C send date', format: (v) => (v ? new Date(v).toLocaleDateString() : 'Not added') },
      { key: 'v5c_received_date', label: 'V5C received', format: (v) => (v ? new Date(v).toLocaleDateString() : 'Not added') },
      { key: 'iva_booked', label: 'IVA booked', format: (v) => v || 'Not added' },
      { key: 'mot_done', label: 'MOT done', format: (v) => (v === true ? 'Yes' : v === false ? 'No' : 'Not added') },
      { key: 'mot_expiry_date', label: 'MOT expiry date', format: (v) => (v ? new Date(v).toLocaleDateString() : 'Not added') },
      { key: 'service_done', label: 'Service done', format: (v) => (v === true ? 'Yes' : v === false ? 'No' : 'Not added') },
      { key: 'v55_registration_done', label: 'V55 registration', format: (v) => (v === true ? 'Yes' : v === false ? 'No' : 'Not added') },
      { key: 'plate_received', label: 'Plate received', format: (v) => (v === true ? 'Yes' : v === false ? 'No' : 'Not added') },
      { key: 'ready_pullout', label: 'Ready for pullout', format: (v) => (v === true ? 'Yes' : v === false ? 'No' : 'Not added') },
    ],
  },
  {
    title: 'Media & listing',
    fields: [
      { key: 'photographed', label: 'Photographed', format: (v) => (v === true ? 'Yes' : v === false ? 'No' : 'Not added') },
      { key: 'photo_drive_link', label: 'Photo drive link', format: (v) => (v ? 'Added' : 'Not added') },
      { key: 'service_record', label: 'Service record', format: (v) => v || 'Not added' },
      { key: 'fb_listed', label: 'FB listed', format: (v) => (v === true ? 'Yes' : v === false ? 'No' : 'Not added') },
      { key: 'web_listed', label: 'Web listed', format: (v) => (v === true ? 'Yes' : v === false ? 'No' : 'Not added') },
      { key: 'web_url', label: 'Web URL', format: (v) => (v ? 'Added' : 'Not added') },
      { key: 'autotrader_listed', label: 'Autotrader listed', format: (v) => (v === true ? 'Yes' : v === false ? 'No' : 'Not added') },
      { key: 'autotrader_url', label: 'Autotrader URL', format: (v) => (v ? 'Added' : 'Not added') },
      { key: 'ads_details', label: 'Ads details', format: (v) => v || 'Not added' },
    ],
  },
  {
    title: 'Condition & extras',
    fields: [
      { key: 'pending_issues', label: 'Pending issues', format: (v) => (v === true ? 'Yes' : v === false ? 'No' : 'Not added') },
      { key: 'pending_issues_details', label: 'Pending issues details', format: (v) => v || 'Not added' },
      { key: 'battery_replaced', label: 'Battery replaced', format: (v) => (v === true ? 'Yes' : v === false ? 'No' : 'Not added') },
      { key: 'extra_parts', label: 'Extra parts', format: (v) => v || 'Not added' },
      { key: 'dial_ordered', label: 'Dial ordered', format: (v) => (v === true ? 'Yes' : v === false ? 'No' : 'Not added') },
      { key: 'body_work_required', label: 'Body work required', format: (v) => (v === true ? 'Yes' : v === false ? 'No' : 'Not added') },
      { key: 'media_system', label: 'Media system', format: (v) => (v === true ? 'Yes' : v === false ? 'No' : 'Not added') },
      { key: 'reverse_camera', label: 'Reverse camera', format: (v) => (v === true ? 'Yes' : v === false ? 'No' : 'Not added') },
      { key: 'front_camera', label: 'Front camera', format: (v) => (v === true ? 'Yes' : v === false ? 'No' : 'Not added') },
      { key: 'front_sensor', label: 'Front sensor', format: (v) => (v === true ? 'Yes' : v === false ? 'No' : 'Not added') },
      { key: 'rear_sensor', label: 'Rear sensor', format: (v) => (v === true ? 'Yes' : v === false ? 'No' : 'Not added') },
      { key: 'spare_key', label: 'Spare key', format: (v) => (v === true ? 'Yes' : v === false ? 'No' : 'Not added') },
    ],
  },
]
