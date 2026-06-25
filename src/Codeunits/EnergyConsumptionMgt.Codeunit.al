codeunit 50100 "Energy Consumption Mgt."
{
    procedure ApplyMeter(var EnergyReading: Record "Energy Reading")
    var
        EnergyMeter: Record "Energy Meter";
    begin
        if EnergyReading."Meter No." = '' then
            exit;
        if not EnergyMeter.Get(EnergyReading."Meter No.") then
            exit;
        EnergyMeter.TestField(Blocked, false);
        EnergyReading."Energy Source Type" := EnergyMeter."Energy Source Type";
        EnergyReading."Unit of Measure Code" := EnergyMeter."Unit of Measure Code";
        if EnergyReading."Tariff Code" = '' then
            EnergyReading."Tariff Code" := EnergyMeter."Tariff Code";
        ApplyTariff(EnergyReading);
    end;

    procedure ApplyTariff(var EnergyReading: Record "Energy Reading")
    var
        EnergyTariff: Record "Energy Tariff";
    begin
        if EnergyReading."Tariff Code" = '' then
            exit;
        if not EnergyTariff.Get(EnergyReading."Tariff Code") then
            exit;
        EnergyReading."Unit Cost" := EnergyTariff."Unit Cost";
        EnergyReading."CO2 Factor" := EnergyTariff."CO2 Factor";
        if (EnergyReading."Unit of Measure Code" = '') and (EnergyTariff."Unit of Measure" <> '') then
            EnergyReading."Unit of Measure Code" := EnergyTariff."Unit of Measure";
    end;

    procedure ComputeConsumption(var EnergyReading: Record "Energy Reading")
    var
        PrevValue: Decimal;
        PrevDate: Date;
    begin
        GetLastReading(EnergyReading."Meter No.", EnergyReading."Reading Date", EnergyReading."Entry No.", PrevValue, PrevDate);
        EnergyReading."Previous Reading Value" := PrevValue;
        EnergyReading."Consumption" := EnergyReading."Reading Value" - PrevValue;
        if (EnergyReading."Consumption" < 0) and not NegativeConsumptionAllowed() then
            EnergyReading."Consumption" := 0;
        EnergyReading."Total Cost" := Round(EnergyReading."Consumption" * EnergyReading."Unit Cost", 0.01);
        EnergyReading."CO2 Emissions" := Round(EnergyReading."Consumption" * EnergyReading."CO2 Factor", 0.001);
    end;

    procedure GetLastReading(MeterNo: Code[20]; BeforeDate: Date; ExcludeEntryNo: Integer; var LastValue: Decimal; var LastDate: Date)
    var
        EnergyReading: Record "Energy Reading";
    begin
        LastValue := 0;
        LastDate := 0D;
        if MeterNo = '' then
            exit;
        EnergyReading.SetCurrentKey("Meter No.", "Reading Date");
        EnergyReading.SetRange("Meter No.", MeterNo);
        if BeforeDate <> 0D then
            EnergyReading.SetFilter("Reading Date", '<=%1', BeforeDate);
        if ExcludeEntryNo <> 0 then
            EnergyReading.SetFilter("Entry No.", '<>%1', ExcludeEntryNo);
        if EnergyReading.FindLast() then begin
            LastValue := EnergyReading."Reading Value";
            LastDate := EnergyReading."Reading Date";
        end;
    end;

    procedure UpdateMeterLastReading(var EnergyReading: Record "Energy Reading")
    var
        EnergyMeter: Record "Energy Meter";
        LastValue: Decimal;
        LastDate: Date;
    begin
        if EnergyReading."Meter No." = '' then
            exit;
        if not EnergyMeter.Get(EnergyReading."Meter No.") then
            exit;
        GetLastReading(EnergyReading."Meter No.", 0D, 0, LastValue, LastDate);
        EnergyMeter."Last Reading Value" := LastValue;
        EnergyMeter."Last Reading Date" := LastDate;
        EnergyMeter.Modify();
    end;

    local procedure NegativeConsumptionAllowed(): Boolean
    var
        EnergyMgtSetup: Record "Energy Mgt. Setup";
    begin
        if not EnergyMgtSetup.Get() then
            exit(false);
        exit(EnergyMgtSetup."Allow Negative Consumption");
    end;
}
