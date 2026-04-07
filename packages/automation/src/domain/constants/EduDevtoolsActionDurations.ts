import { PlaywrightCmd } from '../entities/Lecture';

export const EDU_DEVTOOLS_ACTION_DURATION_MS: Partial<Record<PlaywrightCmd, number>> = {
  open_devtools: 400,
  select_devtools_node: 600,
  toggle_devtools_node: 400,
};
