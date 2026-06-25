page 50101 "Energy Meter Card"
{
    PageType = Card;
    ApplicationArea = All;
    UsageCategory = None;
    SourceTable = "Energy Meter";
    Caption = 'Energy Meter';

    layout
    {
        area(Content)
        {
            group(General)
            {
                Caption = 'General';
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
                field("Serial No."; Rec."Serial No.")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the serial number of the physical meter.';
                }
                field("Unit of Measure Code"; Rec."Unit of Measure Code")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the unit of measure for the meter readings.';
                }
                field("Tariff Code"; Rec."Tariff Code")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the default tariff used to cost readings for this meter.';
                }
                field(Blocked; Rec.Blocked)
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies whether the meter is blocked from new readings.';
                }
            }
            group(Installation)
            {
                Caption = 'Installation';
                field("Location Code"; Rec."Location Code")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the location where the meter is installed.';
                }
                field("Installation Date"; Rec."Installation Date")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the date the meter was installed.';
                }
                field("Responsible Person"; Rec."Responsible Person")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the user responsible for the meter.';
                }
            }
            group(Statistics)
            {
                Caption = 'Statistics';
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
                field("No. of Readings"; Rec."No. of Readings")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies how many readings have been registered for the meter.';
                }
                field("Total Consumption"; Rec."Total Consumption")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the total consumption recorded for the meter.';
                }
                field("Total Cost"; Rec."Total Cost")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the total cost calculated for the meter.';
                }
                field("Total CO2 Emissions"; Rec."Total CO2 Emissions")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the total CO2 emissions calculated for the meter.';
                }
            }
            part(Readings; "Energy Meter Readings")
            {
                ApplicationArea = All;
                Caption = 'Readings';
                SubPageLink = "Meter No." = field("No.");
                UpdatePropagation = Both;
            }
        }
    }

    actions
    {
        area(Processing)
        {
            action(AllReadings)
            {
                ApplicationArea = All;
                Caption = 'All Readings';
                Image = Entries;
                RunObject = page "Energy Reading List";
                RunPageLink = "Meter No." = field("No.");
                ToolTip = 'View all readings registered for this meter.';
            }
        }
    }
}
