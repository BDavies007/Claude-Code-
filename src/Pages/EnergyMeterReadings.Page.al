page 50102 "Energy Meter Readings"
{
    PageType = ListPart;
    ApplicationArea = All;
    SourceTable = "Energy Reading";
    Caption = 'Readings';
    AutoSplitKey = true;
    DelayedInsert = true;

    layout
    {
        area(Content)
        {
            repeater(Group)
            {
                field("Reading Date"; Rec."Reading Date")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the date of the reading.';
                }
                field("Reading Value"; Rec."Reading Value")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the value read from the meter.';
                }
                field("Consumption"; Rec."Consumption")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the consumption since the previous reading.';
                }
                field("Reading Type"; Rec."Reading Type")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies how the reading was captured.';
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
