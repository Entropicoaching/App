export const measurement = () => ({
  schema: 'va-k4-synthetic/v1', status: 'synthetic_only', lift: 'squat', setup_id: 'synthetic',
  units: { time: 's', position: 'px_x_anterior_y_down', angle: 'deg_inner_0_180', scale: 'cm_per_px' },
  phase: { name: 'concentric', start: 0, end: 2 }, cm_per_px: 1,
  uncertainty: { x_px: 0, y_px: 0, body_y_px: 0, knee_deg: 0, scale_cm_per_px: 0, time_s: 0 },
  samples: [
    { t_s: 0, valid: true, bar_x_px: 0, bar_y_px: 100, hip_y_px: 100, shoulder_y_px: 80, knee_deg: 100 },
    { t_s: 1, valid: true, bar_x_px: 4, bar_y_px: 90, hip_y_px: 80, shoulder_y_px: 70, knee_deg: 80 },
    { t_s: 2, valid: true, bar_x_px: 4, bar_y_px: 50, hip_y_px: 60, shoulder_y_px: 60, knee_deg: 120 },
  ],
})
