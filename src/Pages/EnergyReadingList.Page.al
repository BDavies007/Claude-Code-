page 50103 "Energy Reading List"
{
    PageType = List;
    ApplicationArea = All;
    UsageCategory = Lists;
    SourceTable = "Energy Reading";
    Caption = 'Energy Readings';

    layout
    {
        area(Content)
        {
            repeater(Group)
            {
                field("Entry No."; Rec."Entry No.")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the unique entry number of the reading.';
                    Visible = false;
                }
                field("Meter No."; Rec."Meter No.")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the meter the reading belongs to.';
                }
                field("Reading Date"; Rec."Reading Date")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the date of the reading.';
                }
                field("Energy Source Type"; Rec."Energy Source Type")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the type of energy measured.';
                }
                field("Reading Value"; Rec."Reading Value")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the value read from the meter.';
                }
                field("Previous Reading Value"; Rec."Previous Reading Value")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the value of the previous reading.';
                }
                field("Consumption"; Rec."Consumption")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the consumption since the previous reading.';
                }
                field("Unit of Measure Code"; Rec."Unit of Measure Code")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the unit of measure of the reading.';
                }
                field("Reading Type"; Rec."Reading Type")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies how the reading was captured.';
                }
                field("Tariff Code"; Rec."Tariff Code")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the tariff applied to the reading.';
                }
                field("Unit Cost"; Rec."Unit Cost")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the cost per unit applied to the reading.';
                }
                field("Total Cost"; Rec."Total Cost")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the cost of the consumption for this reading.';
                }
                field("CO2 Emissions"; Rec."CO2 Emissions")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the CO2 emissions for this reading.';
                }
            }
        }
    }
}
