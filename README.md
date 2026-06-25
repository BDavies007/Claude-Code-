# Energy Management for Dynamics 365 Business Central

An AL extension for Microsoft Dynamics 365 Business Central that tracks energy
meters, captures readings, and calculates consumption, cost and CO2 emissions
across electricity, gas, water and renewable sources.

## Features

- **Energy meters** — register meters per energy source (electricity, natural
  gas, water, solar, wind, heat, steam) with location, serial number and a
  default tariff.
- **Energy readings** — capture meter readings; consumption is calculated
  automatically as the delta from the previous reading.
- **Tariffs** — define unit cost, currency and a CO2 factor (kg per unit) per
  energy source and validity period.
- **Cost & emissions** — each reading is automatically costed and its CO2
  emissions calculated from the applicable tariff.
- **Statistics** — meters roll up number of readings, total consumption, total
  cost and total CO2 emissions via FlowFields.
- **Role Center & profile** — an "Energy Manager" role center surfaces meters,
  readings, tariffs and setup.

## Object model

| Object | ID | Type |
| --- | --- | --- |
| Energy Source Type | 50100 | Enum |
| Energy Reading Type | 50101 | Enum |
| Energy Meter | 50100 | Table |
| Energy Reading | 50101 | Table |
| Energy Tariff | 50102 | Table |
| Energy Mgt. Setup | 50103 | Table |
| Energy Consumption Mgt. | 50100 | Codeunit |
| Energy Mgt. Install | 50101 | Codeunit |
| Energy Meter List | 50100 | Page |
| Energy Meter Card | 50101 | Page |
| Energy Meter Readings | 50102 | Page (ListPart) |
| Energy Reading List | 50103 | Page |
| Energy Tariff List | 50104 | Page |
| Energy Mgt. Setup | 50105 | Page |
| Energy Mgt. Role Center | 50106 | Page |
| Energy Manager | — | Profile |

Object ID range: **50100–50199**.

## How consumption is calculated

When a reading is entered, the extension finds the most recent prior reading on
the same meter (`Energy Consumption Mgt.GetLastReading`) and computes:

- `Consumption = Reading Value - Previous Reading Value`
- `Total Cost = Consumption x Unit Cost`
- `CO2 Emissions = Consumption x CO2 Factor`

Negative consumption (a reading lower than the previous one, e.g. a meter
replacement) is clamped to zero unless **Allow Negative Consumption** is enabled
in setup.

## Getting started

1. Open the project in Visual Studio Code with the AL Language extension.
2. Set up a Business Central sandbox in `.vscode/launch.json` (not included).
3. Press `F5` to compile and publish the extension.
4. Open **Energy Management Setup**, assign a **Meter Nos.** number series, and
   start registering meters.

## License

Apache License 2.0 — see [LICENSE](LICENSE).
