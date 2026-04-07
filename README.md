# ScienceWorld Visualizer

Simple static frontend for replaying `lm_studio_agent.py` JSON logs.

## What it shows

- a simplified map of the default ScienceWorld building
- the agent location at each step
- the chosen action and raw model output
- the observation returned by the environment
- the cumulative score through the run

## How to use

1. Generate a JSON log with `examples/lm_studio_agent.py`.
2. Open `visualizer/index.html` in a browser.
3. Click `Open Log` and choose the generated JSON file.

## Notes

- The map is based on the default room graph defined by the base environment.
- Location highlighting uses `location_before` and `location_after` saved in the log.
- This frontend is static and does not require a backend.
