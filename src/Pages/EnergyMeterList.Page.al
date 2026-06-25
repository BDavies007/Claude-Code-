page 50100 "Energy Meter List"
{
    PageType = List;
    ApplicationArea = All;
    UsageCategory = Lists;
    SourceTable = "Energy Meter";
    CardPageId = "Energy Meter Card";
    Caption = 'Energy Meters';

    layout
    {
        area(Content)
        {
            repeater(Group)
            {
                field("No."; Rec."No.")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the unique number of the energy meter.';
                }
                field(Description; Rec.Description)
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies a description of the energy meter.';
                }
                field("Energy Source Type"; Rec."Energy Source Type")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the type of energy that the meter measures.';
                }
                field("Location Code"; Rec."Location Code")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the location where the meter is installed.';
                }
                field("Unit of Measure Code"; Rec."Unit of Measure Code")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the unit of measure for the meter readings.';
                }
                field("Last Reading Value"; Rec."Last Reading Value")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the value of the most recent reading.';
                }
                field("Last Reading Date"; Rec."Last Reading Date")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the date of the most recent reading.';
                }
                field("Total Consumption"; Rec."Total Consumption")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the total consumption recorded for the meter.';
                }
                field("Total CO2 Emissions"; Rec."Total CO2 Emissions")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the total CO2 emissions calculated for the meter.';
                }
                field(Blocked; Rec.Blocked)
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies whether the meter is blocked from new readings.';
                }
            }
        }
    }

    actions
    {
        area(Processing)
        {
            action(Readings)
            {
                ApplicationArea = All;
                Caption = 'Readings';
                Image = Entries;
                RunObject = page "Energy Reading List";
                RunPageLink = "Meter No." = field("No.");
                ToolTip = 'View the readings registered for this meter.';
            }
        }
        area(Navigation)
        {
            action(Tariffs)
            {
                ApplicationArea = All;
                Caption = 'Tariffs';
                Image = PriceWorksheet;
                RunObject = page "Energy Tariff List";
                ToolTip = 'View and maintain energy tariffs.';
            }
        }
    }
}
