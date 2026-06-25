table 50100 "Energy Meter"
{
    Caption = 'Energy Meter';
    DataClassification = CustomerContent;
    LookupPageId = "Energy Meter List";
    DrillDownPageId = "Energy Meter List";

    fields
    {
        field(1; "No."; Code[20])
        {
            Caption = 'No.';
        }
        field(2; "Description"; Text[100])
        {
            Caption = 'Description';
        }
        field(3; "Energy Source Type"; Enum "Energy Source Type")
        {
            Caption = 'Energy Source Type';
        }
        field(4; "Location Code"; Code[10])
        {
            Caption = 'Location Code';
            TableRelation = Location;
        }
        field(5; "Unit of Measure Code"; Code[10])
        {
            Caption = 'Unit of Measure Code';
            TableRelation = "Unit of Measure";
        }
        field(6; "Serial No."; Text[50])
        {
            Caption = 'Serial No.';
        }
        field(7; "Installation Date"; Date)
        {
            Caption = 'Installation Date';
        }
        field(8; "Tariff Code"; Code[20])
        {
            Caption = 'Tariff Code';
            TableRelation = "Energy Tariff";
        }
        field(9; "Responsible Person"; Code[50])
        {
            Caption = 'Responsible Person';
            TableRelation = "User Setup"."User ID";
            DataClassification = EndUserIdentifiableInformation;
        }
        field(10; "Blocked"; Boolean)
        {
            Caption = 'Blocked';
        }
        field(20; "Last Reading Value"; Decimal)
        {
            Caption = 'Last Reading Value';
            Editable = false;
        }
        field(21; "Last Reading Date"; Date)
        {
            Caption = 'Last Reading Date';
            Editable = false;
        }
        field(30; "No. of Readings"; Integer)
        {
            Caption = 'No. of Readings';
            Editable = false;
            FieldClass = FlowField;
            CalcFormula = count("Energy Reading" where("Meter No." = field("No.")));
        }
        field(31; "Total Consumption"; Decimal)
        {
            Caption = 'Total Consumption';
            Editable = false;
            FieldClass = FlowField;
            CalcFormula = sum("Energy Reading"."Consumption" where("Meter No." = field("No.")));
        }
        field(32; "Total Cost"; Decimal)
        {
            Caption = 'Total Cost';
            Editable = false;
            AutoFormatType = 1;
            FieldClass = FlowField;
            CalcFormula = sum("Energy Reading"."Total Cost" where("Meter No." = field("No.")));
        }
        field(33; "Total CO2 Emissions"; Decimal)
        {
            Caption = 'Total CO2 Emissions (kg)';
            Editable = false;
            FieldClass = FlowField;
            CalcFormula = sum("Energy Reading"."CO2 Emissions" where("Meter No." = field("No.")));
        }
    }

    keys
    {
        key(PK; "No.")
        {
            Clustered = true;
        }
        key(Source; "Energy Source Type")
        {
        }
    }

    fieldgroups
    {
        fieldgroup(DropDown; "No.", "Description", "Energy Source Type")
        {
        }
        fieldgroup(Brick; "No.", "Description", "Energy Source Type", "Last Reading Value")
        {
        }
    }

    trigger OnInsert()
    begin
        if "No." = '' then begin
            EnergyMgtSetup.Get();
            EnergyMgtSetup.TestField("Meter Nos.");
            "No." := NoSeries.GetNextNo(EnergyMgtSetup."Meter Nos.");
        end;
    end;

    var
        EnergyMgtSetup: Record "Energy Mgt. Setup";
        NoSeries: Codeunit "No. Series";
}
