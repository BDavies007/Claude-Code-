table 50103 "Energy Mgt. Setup"
{
    Caption = 'Energy Management Setup';
    DataClassification = CustomerContent;

    fields
    {
        field(1; "Primary Key"; Code[10])
        {
            Caption = 'Primary Key';
        }
        field(2; "Meter Nos."; Code[20])
        {
            Caption = 'Meter Nos.';
            TableRelation = "No. Series";
        }
        field(3; "Default Currency Code"; Code[10])
        {
            Caption = 'Default Currency Code';
            TableRelation = Currency;
        }
        field(4; "Default Unit of Measure"; Code[10])
        {
            Caption = 'Default Unit of Measure';
            TableRelation = "Unit of Measure";
        }
        field(5; "Default CO2 Factor"; Decimal)
        {
            Caption = 'Default CO2 Factor (kg/Unit)';
            MinValue = 0;
            DecimalPlaces = 0 : 5;
        }
        field(6; "Allow Negative Consumption"; Boolean)
        {
            Caption = 'Allow Negative Consumption';
        }
    }

    keys
    {
        key(PK; "Primary Key")
        {
            Clustered = true;
        }
    }

    procedure GetRecordOnce()
    begin
        if Rec.Get() then
            exit;
        Rec.Init();
        Rec.Insert();
    end;
}
