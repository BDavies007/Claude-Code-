enum 50101 "Energy Reading Type"
{
    Extensible = true;
    Caption = 'Energy Reading Type';

    value(0; Manual)
    {
        Caption = 'Manual';
    }
    value(1; Automatic)
    {
        Caption = 'Automatic';
    }
    value(2; Estimated)
    {
        Caption = 'Estimated';
    }
    value(3; Corrected)
    {
        Caption = 'Corrected';
    }
}
