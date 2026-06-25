page 50105 "Energy Mgt. Setup"
{
    PageType = Card;
    ApplicationArea = All;
    UsageCategory = Administration;
    SourceTable = "Energy Mgt. Setup";
    Caption = 'Energy Management Setup';
    InsertAllowed = false;
    DeleteAllowed = false;

    layout
    {
        area(Content)
        {
            group(Numbering)
            {
                Caption = 'Numbering';
                field("Meter Nos."; Rec."Meter Nos.")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the number series used to assign numbers to new energy meters.';
                }
            }
            group(Defaults)
            {
                Caption = 'Defaults';
                field("Default Currency Code"; Rec."Default Currency Code")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the default currency for energy costs.';
                }
                field("Default Unit of Measure"; Rec."Default Unit of Measure")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the default unit of measure for new meters.';
                }
                field("Default CO2 Factor"; Rec."Default CO2 Factor")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the default CO2 factor used when a tariff does not define one.';
                }
                field("Allow Negative Consumption"; Rec."Allow Negative Consumption")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies whether readings lower than the previous reading may produce negative consumption.';
                }
            }
        }
    }

    trigger OnOpenPage()
    begin
        Rec.GetRecordOnce();
    end;
}
