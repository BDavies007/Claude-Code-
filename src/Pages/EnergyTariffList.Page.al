page 50104 "Energy Tariff List"
{
    PageType = List;
    ApplicationArea = All;
    UsageCategory = Lists;
    SourceTable = "Energy Tariff";
    Caption = 'Energy Tariffs';

    layout
    {
        area(Content)
        {
            repeater(Group)
            {
                field("Code"; Rec."Code")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the unique code of the tariff.';
                }
                field(Description; Rec.Description)
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies a description of the tariff.';
                }
                field("Energy Source Type"; Rec."Energy Source Type")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the type of energy the tariff applies to.';
                }
                field("Unit Cost"; Rec."Unit Cost")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the cost per unit of energy.';
                }
                field("Currency Code"; Rec."Currency Code")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the currency of the unit cost.';
                }
                field("CO2 Factor"; Rec."CO2 Factor")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the kilograms of CO2 emitted per unit of energy.';
                }
                field("Unit of Measure"; Rec."Unit of Measure")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the unit of measure the tariff is based on.';
                }
                field("Starting Date"; Rec."Starting Date")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the first date the tariff is valid.';
                }
                field("Ending Date"; Rec."Ending Date")
                {
                    ApplicationArea = All;
                    ToolTip = 'Specifies the last date the tariff is valid.';
                }
            }
        }
    }
}
