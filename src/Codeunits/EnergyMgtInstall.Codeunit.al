codeunit 50101 "Energy Mgt. Install"
{
    Subtype = Install;

    trigger OnInstallAppPerCompany()
    var
        EnergyMgtSetup: Record "Energy Mgt. Setup";
    begin
        EnergyMgtSetup.GetRecordOnce();
    end;
}
