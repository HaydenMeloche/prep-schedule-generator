# Prep Schedule Generator

A dependency-free static website for generating a valid five-day prep teacher
route.

## Use

Open `index.html` in a browser, then click **Generate Prep Teacher Route**.
Each filled cell tells the prep teacher which class to cover at that time.
Every class gets at least one prep block each day.

## GitHub Pages

This project can be hosted directly from GitHub Pages with no build step:

1. Push these files to a GitHub repository.
2. In the repository, open **Settings > Pages**.
3. Set the source to the branch and folder that contains `index.html`.

## Scheduling Rules

- Classes: EK, E1A, E12, E23.
- Each teacher receives exactly 240 minutes of prep per week.
- Each teacher receives at least one prep block every day.
- Prep blocks are 40 or 60 minutes.
- Only one class can be covered by the prep teacher in a 20-minute slot.
- Prep is scheduled only in the morning and afternoon blocks.
- Nutrition breaks and the 11:35-1:15 middle block never receive prep.
