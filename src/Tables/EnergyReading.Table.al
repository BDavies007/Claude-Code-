table 50101 "Energy Reading"
{
    Caption = 'Energy Reading';
    DataClassification = CustomerContent;
    LookupPageId = "Energy Reading List";
    DrillDownPageId = "Energy Reading List";

    fields
    {
        field(1; "Entry No."; Integer)
        {
            Caption = 'Entry No.';
            AutoIncrement = true;
        }
        field(2; "Meter No."; Code[20])
        {
            Caption = 'Meter No.';
            NotBlank = true;
            TableRelation = "Energy Meter";

            trigger OnValidate()
            begin
                EnergyMgt.ApplyMeter(Rec);
                EnergyMgt.ComputeConsumption(Rec);
            end;
        }
        field(3; "Reading Date"; Date)
        {
            Caption = 'Reading Date';

            trigger OnValidate()
            begin
                EnergyMgt.ComputeConsumption(Rec);
            end;
        }
        field(4; "Reading Value"; Decimal)
        {
            Caption = 'Reading Value';

            trigger OnValidate()
            begin
                EnergyMgt.ComputeConsumption(Rec);
            end;
        }
        field(5; "Previous Reading Value"; Decimal)
        {
            Caption = 'Previous Reading Value';
            Editable = false;
        }
        field(6; "Consumption"; Decimal)
        {
            Caption = 'Consumption';
            Editable = false;
        }
        field(7; "Energy Source Type"; Enum "Energy Source Type")
        {
            Caption = 'Energy Source Type';
            Editable = false;
        }
        field(8; "Unit of Measure Code"; Code[10])
        {
            Caption = 'Unit of Measure Code';
            TableRelation = "Unit of Measure";
            Editable = false;
        }
        field(9; "Reading Type"; Enum "Energy Reading Type")
        {
            Caption = 'Reading Type';
        }
        field(10; "Tariff Code"; Code[20])
        {
            Caption = 'Tariff Code';
            TableRelation = "Energy Tariff";

            trigger OnValidate()
            begin
                EnergyMgt.ApplyTariff(Rec);
                EnergyMgt.ComputeConsumption(Rec);
            end;
        }
        field(11; "Unit Cost"; Decimal)
        {
            Caption = 'Unit Cost';
            AutoFormatType = 2;

            trigger OnValidate()
            begin
                EnergyMgt.ComputeConsumption(Rec);
            end;
        }
        field(12; "Total Cost"; Decimal)
        {
            Caption = 'Total Cost';
            Editable = false;
            AutoFormatType = 1;
        }
        field(13; "CO2 Factor"; Decimal)
        {
            Caption = 'CO2 Factor (kg/Unit)';
            DecimalPlaces = 0 : 5;

            trigger OnValidate()
            begin
                EnergyMgt.ComputeConsumption(Rec);
            end;
        }
        field(14; "CO2 Emissions"; Decimal)
        {
            Caption = 'CO2 Emissions (kg)';
            Editable = false;
        }
        field(15; "Comment"; Text[250])
        {
            Caption = 'Comment';
        }
        field(16; "Created By"; Code[50])
        {
            Caption = 'Created By';
            Editable = false;
            DataClassification = EndUserIdentifiableInformation;
        }
        field(17; "Created DateTime"; DateTime)
        {
            Caption = 'Created DateTime';
            Editable = false;
        }
    }

    keys
    {
        key(PK; "Entry No.")
        {
            Clustered = true;
        }
        key(Meter; "Meter No.", "Reading Date")
        {
        }
        key(SourceDate; "Energy Source Type", "Reading Date")
        {
        }
    }

    fieldgroups
    {
        fieldgroup(DropDown; "Entry No.", "Meter No.", "Reading Date", "Consumption")
        {
        }
    }

    trigger OnInsert()
    begin
        "Created By" := CopyStr(UserId(), 1, MaxStrLen("Created By"));
        "Created DateTime" := CurrentDateTime();
        if "Reading Date" = 0D then
            "Reading Date" := Today();
        EnergyMgt.UpdateMeterLastReading(Rec);
    end;

    trigger OnModify()
    begin
        EnergyMgt.UpdateMeterLastReading(Rec);
    end;

    trigger OnDelete()
    begin
        EnergyMgt.UpdateMeterLastReading(Rec);
    end;

    var
        EnergyMgt: Codeunit "Energy Consumption Mgt.";
}
