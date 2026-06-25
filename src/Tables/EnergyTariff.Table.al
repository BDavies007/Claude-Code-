table 50102 "Energy Tariff"
{
    Caption = 'Energy Tariff';
    DataClassification = CustomerContent;
    LookupPageId = "Energy Tariff List";
    DrillDownPageId = "Energy Tariff List";

    fields
    {
        field(1; "Code"; Code[20])
        {
            Caption = 'Code';
            NotBlank = true;
        }
        field(2; "Description"; Text[100])
        {
            Caption = 'Description';
        }
        field(3; "Energy Source Type"; Enum "Energy Source Type")
        {
            Caption = 'Energy Source Type';
        }
        field(4; "Unit Cost"; Decimal)
        {
            Caption = 'Unit Cost';
            MinValue = 0;
            AutoFormatType = 2;
        }
        field(5; "Currency Code"; Code[10])
        {
            Caption = 'Currency Code';
            TableRelation = Currency;
        }
        field(6; "CO2 Factor"; Decimal)
        {
            Caption = 'CO2 Factor (kg/Unit)';
            MinValue = 0;
            DecimalPlaces = 0 : 5;
        }
        field(7; "Unit of Measure"; Code[10])
        {
            Caption = 'Unit of Measure';
            TableRelation = "Unit of Measure";
        }
        field(8; "Starting Date"; Date)
        {
            Caption = 'Starting Date';
        }
        field(9; "Ending Date"; Date)
        {
            Caption = 'Ending Date';
        }
    }

    keys
    {
        key(PK; "Code")
        {
            Clustered = true;
        }
        key(Source; "Energy Source Type", "Starting Date")
        {
        }
    }

    fieldgroups
    {
        fieldgroup(DropDown; "Code", "Description", "Unit Cost")
        {
        }
    }
}
