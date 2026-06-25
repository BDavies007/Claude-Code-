page 50106 "Energy Mgt. Role Center"
{
    PageType = RoleCenter;
    Caption = 'Energy Management';

    actions
    {
        area(Sections)
        {
            group(Meters)
            {
                Caption = 'Energy';
                action(EnergyMeters)
                {
                    ApplicationArea = All;
                    Caption = 'Energy Meters';
                    Image = Meter;
                    RunObject = page "Energy Meter List";
                    ToolTip = 'View and maintain energy meters.';
                }
                action(EnergyReadings)
                {
                    ApplicationArea = All;
                    Caption = 'Energy Readings';
                    Image = Entries;
                    RunObject = page "Energy Reading List";
                    ToolTip = 'View and register energy readings.';
                }
                action(EnergyTariffs)
                {
                    ApplicationArea = All;
                    Caption = 'Energy Tariffs';
                    Image = PriceWorksheet;
                    RunObject = page "Energy Tariff List";
                    ToolTip = 'View and maintain energy tariffs.';
                }
            }
        }
        area(Embedding)
        {
            action(MetersEmbed)
            {
                ApplicationArea = All;
                Caption = 'Energy Meters';
                RunObject = page "Energy Meter List";
                ToolTip = 'View and maintain energy meters.';
            }
        }
        area(Processing)
        {
            group(Setup)
            {
                Caption = 'Setup';
                action(EnergyMgtSetupAction)
                {
                    ApplicationArea = All;
                    Caption = 'Energy Management Setup';
                    Image = Setup;
                    RunObject = page "Energy Mgt. Setup";
                    ToolTip = 'Open the energy management setup.';
                }
            }
        }
    }
}
