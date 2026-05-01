# Trickee AI/ML Challenge: Personalized Route Intelligence

## The Objective

Design a predictive engine that provides **Personalized Route Optimization** and **Dynamic
Departure Nudges**. Your model must not only analyze general traffic but also adapt to a
specific driver’s historical behavior and performance which in turn is used to predict for a
7-day period.

## The Challenge Parameters

```
● Point A & B: You must choose your own Origin and Destination (e.g., your home to
your workplace/college).
● Personalized Driver Profile: You must simulate or source data of historical trip data
for this specific user, including:
○ Actual departure and arrival times.
○ Variations in "Driving Style" (e.g., does this driver take 15% longer than
Google Maps' estimate due to a conservative driving style?).
○ Route preferences (e.g., avoiding high-traffic junctions even if the alternative
is 200 meters longer).
```
## Core Requirements

Your model must output the following for **Weekday (Morning/Evening)** and **Weekend
(Brunch/Night)** scenarios:
● **Multi-Route Comparison:** Compare all different routes to reach the destination and
show results which one is the best and ETA at the destination and also provide nudges
to leave accordingly with a buffer of 10 mins.
● **The "Personalized Nudge":** A departure recommendation tailored to the driver's
specific history (e.g., _"Based on your past 3 Monday trips, you take 8 minutes longer
than average at this hour. Leave at 8:40 AM to ensure 9:30 AM arrival"_ ).
● **Traffic Condition Weights:** Clearly define how the model weights different
conditions (e.g., signal density vs. average cruising speed).
**The Technical Specifications:
Objective** : Implement a multi-objective optimization model for a 7-day transit schedule.
**Dynamic Scheduling:** Provide a daily 'Best Time to Leave' nudge that adjusts to the
predicted traffic of that specific weekday or weekend.


**Dynamic Rerouting:** Logic must allow for real-time recalculation based on live
sensor/traffic data.
**Multi-Route Output:** Show the primary optimized path vs. a secondary Google Maps-style
fallback.
**EV Energy Mapping:** Integrate energy-consumption parameters. The model should be able
to prioritize a 'Maximum Range' route (low stop-and-go, steady speeds) over a 'Minimum
Time' route to ensure optimal battery State of Charge (SoC).


