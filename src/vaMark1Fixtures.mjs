// Constructed scenes only. Disc center is visual truth, not the automatic estimate.
export function fixtures() {
  return [0, 1, 2].map(c => ({
    schema: 'va-mark1-synthetic/v2', status: 'synthetic_only', clip_id: 'synthetic-' + (c + 1),
    setup_id: 'fixed-side-camera-' + c, revision: 'R1-VA-MARK1-v2',
    image: { width: 640, height: 360 }, axis: 'px_x_right_y_down', time_unit: 's', clock: 'actual_timestamps',
    frames: [0, 0.2, 0.55, 1.1].map((t_s, i) => {
      const x = 240 + i * 10, y = 260 - 80 * t_s;
      const noise = c === 0 ? [0.2, -0.2, 0.2, 0][i] : c === 1 ? 3 : [0, 4, -4, 0][i];
      return { frame_id: i * 7, t_s, disc: { x, y }, disc_px: 90, automatic: { x: x + (c === 1 ? 1 : 0), y: y + noise } };
    })
  }));
}
